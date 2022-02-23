import { resolve, dirname } from 'path';
import { existsSync, symlinkSync, writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import { interfaces } from 'inversify';
import { Configs } from './configs';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Login } from './login';
import { effect } from '@vue/reactivity';
import { ConfigCacheAble } from '@nppm/cache';
import { TApplication, TApplicationPackageJSONState } from "./interface";
import { 
  isProduction, 
  createORMObserver, 
  ORM_TIMESTAMP, 
  createRedisObserver, 
  ORM_CONNECTION_CONTEXT, 
  HTTP_APPLICATION_CONTEXT, 
  HTTP_SERVER_CONTEXT, 
  REDIS_CONNECTION_CONTEXT, 
  logger,
  ORM_INSTALLED,
  REDIS_INSTALLED
} from '@nppm/utils';
import { 
  HttpServiceUnavailableException, 
  HttpMovedPermanentlyException, 
  HttpOKException, 
  HttpNotFoundException,
} from '@typeservice/exception';

export * from './configs';
export * from './interface';
export * from './login';

let id = 1;

interface TPluginInstallInfomation {
  id: number,
  status: -2 | -1 | 0 | 1 | 2,
  startTimeStamp: number,
  endTimeStamp: number,
  installedTimeStamp: number,
  msg?: string[],
  error?: string,
  process: ChildProcessWithoutNullStreams
}

export class NPMCore {
  public readonly orm = ORM_CONNECTION_CONTEXT;
  public readonly redis = REDIS_CONNECTION_CONTEXT;
  public readonly http = HTTP_APPLICATION_CONTEXT;
  public readonly server = HTTP_SERVER_CONTEXT;
  public readonly HOME = isProduction ? process.cwd() : process.env.HOME;
  public readonly installers = new Map<string, TPluginInstallInfomation>();
  public readonly configs = new Configs(this.HOME);
  private readonly entities = new Set<interfaces.Newable<any>>();
  private readonly applications = new Map<string, TApplicationPackageJSONState>();
  private readonly logins = new Map<string, Login>();

  get logger() {
    return logger;
  }
  
  public addORMEntities(...enitities: interfaces.Newable<any>[]) {
    const i = this.entities.size;
    enitities.forEach(entity => this.entities.add(entity));
    const j = this.entities.size;
    if (i !== j) ORM_TIMESTAMP.value = Date.now();
    return this;
  }

  public createORMServer() {
    return () => createORMObserver({
      synchronize: true,
      entities: Array.from(this.entities.values()),
      configs: this.configs.value.orm,
    })();
  }

  public createRedisServer() {
    return () => createRedisObserver(this.configs.value.redis)();
  }

  public createApplicationServer() {
    return () => {
      effect(() => {
        if (ORM_INSTALLED.value && REDIS_INSTALLED.value) {
          const dependencies = this.configs.value.dependencies;
          for (const key in dependencies) {
            this.installApplication(key)
              .then(() => logger.info('已安装插件', key))
              .catch(e => logger.error(e));
          }
        }
      })
    }
  }

  private async installApplication(key: string, dev?: boolean) {
    if (this.applications.has(key)) return false;
    const dictionary = resolve(this.HOME, 'node_modules', key);
    const pkgfilename = resolve(dictionary, 'package.json');
    if (!existsSync(pkgfilename)) return;
    const pkg = require(pkgfilename) as TApplicationPackageJSONState;
    if (!pkg.nppm) return false;
    const application = require(!isProduction ? resolve(dictionary, dev ? pkg.devmain : pkg.main) : dictionary);
    const installer = (application.default || application) as TApplication;
    console.log('setup', 1, installer, typeof installer ==='function' ? installer.toString() : null);
    pkg._uninstall = await Promise.resolve(installer(this));
    console.log('setup', 2, pkg._uninstall, typeof pkg._uninstall === 'function' ? pkg._uninstall.toString() : null)
    this.applications.set(key, pkg);
    return true;
  }

  public async install(app: string, dev?: boolean, registry?: string) {
    if (dev) {
      if (!existsSync(app)) throw new HttpServiceUnavailableException('找不到插件');
      const pkgfilename = resolve(app, 'package.json');
      if (!existsSync(pkgfilename)) throw new HttpServiceUnavailableException('找不到插件的描述文件');
      const pkg = require(pkgfilename);
      if (!pkg.name || !pkg.devmain || !pkg.nppm) throw new HttpServiceUnavailableException('插件元信息不正确');
      const target = resolve(this.HOME, 'node_modules', pkg.name);
      const dir = dirname(target);
      ensureDirSync(dir);
      symlinkSync(app, target);
      if (!this.configs.value.dependencies) this.configs.value.dependencies = {};
      this.configs.value.dependencies[pkg.name] = 'file:' + app;
      this.configs.saveFile();
      return await this.installApplication(pkg.name, true);
    }
    this.installers.set(app, this.createInstallPluginTask(app, registry));
    return true;
  }

  private createInstallPluginTask(app: string, registry?: string): TPluginInstallInfomation {
    const state: TPluginInstallInfomation = {
      id: id++,
      status: 0,
      startTimeStamp: Date.now(),
      endTimeStamp: null,
      installedTimeStamp: null,
      msg: [],
      error: null,
      process: null
    }
    const args: string[] = ['install', app];
    if (registry) args.push('--registry=' + registry);
    args.push('--no-package-lock');
    const ls = spawn('npm', args, { cwd: this.HOME });
    ls.on('error', e => state.error = e.message);
    ls.stdout.on('data', m => state.msg.push(m.toString()));
    ls.stderr.on('data', m => state.msg.push(m.toString()));
    ls.on('exit', code => {
      state.endTimeStamp = Date.now();
      state.process = null;
      if (code !== 0) {
        state.status = -1;
      } else {
        state.status = 1;
        this.installApplication(app).then(() => {
          state.status = 2;
        }).catch(e => {
          state.status = -2;
          state.error = e.message;
        }).finally(() => {
          state.installedTimeStamp = Date.now();
        });
      }
    })
    state.process = ls;
    return state;
  }

  public createInstallHistoryDestroyServer() {
    return () => {
      for (const [, value] of this.installers) {
        const _process = value.process;
        if (_process) {
          _process.kill('SIGTERM');
          value.process = null;
        }
      }
    }
  }

  public async uninstall(app: string) {
    if (!this.applications.has(app)) throw new HttpNotFoundException('找不到卸载的应用');
    const state = this.applications.get(app);
    if (state._uninstall) await Promise.resolve(state._uninstall());
    this.applications.delete(app);
    await new Promise<void>((resolved, reject) => {
      const ls = spawn('npm', ['uninstall', app], { cwd: this.HOME })
      ls.on('exit', code => {
        if (code !== 0) return reject(new HttpServiceUnavailableException('application ' + app + ' uninstall failed.'));
        resolved();
      })
    })
  }

  public createLoginModule(name: string) {
    return new Login(name);
  }

  public addLoginModule(login: Login) {
    this.logins.set(login.namespace, login);
    return login;
  }

  public hasLoginModule(name: string) {
    return this.logins.has(name);
  }

  public getLoginModule(name: string) {
    return this.logins.get(name);
  }

  public removeLoginModule(login: Login) {
    if (this.logins.has(login.namespace)) {
      this.logins.delete(login.namespace);
    }
    return this;
  }

  public getLogins() {
    const outs: Pick<TApplicationPackageJSONState, 'description' | 'name' | 'plugin_icon' | 'plugin_name' | 'version'>[] = []
    Array.from(this.logins.keys()).forEach(name => {
      if (this.applications.has(name)) {
        const value = this.applications.get(name);
        outs.push({
          name: value.name,
          version: value.version,
          description: value.description,
          plugin_icon: value.plugin_icon,
          plugin_name: value.plugin_name,
        })
      }
    })
    return outs;
  }

  public getPlugins() {
    return Array.from(this.applications.values());
  }

  private toAuthorizeKey(session: string) {
    return 'npm:login:' + session;
  }

  public async setLoginAuthorize(state: string) {
    const key = this.toAuthorizeKey(state);
    if (await this.redis.value.exists(key)) {
      const value = await this.redis.value.get(key);
      await this.redis.value.del(key);
      const configs = await ConfigCacheAble.get(null, this.orm.value);
      if (value.startsWith(configs.domain)) {
        return new HttpMovedPermanentlyException(value);
      }
    }
    return new HttpOKException();
  }

  public loadPluginConfigs(name: string) {
    if (!this.applications.has(name)) throw new HttpNotFoundException('找不到插件');
    const state = this.applications.get(name);
    if (!state.plugin_configs) state.plugin_configs = [];
    return state.plugin_configs;
  }

  public loadPluginState(name: string) {
    if (!this.applications.has(name)) throw new HttpNotFoundException('找不到插件');
    const state = this.applications.get(name);
    if (!state.plugin_configs) state.plugin_configs = [];
    const out: Record<string, any> = {};
    state.plugin_configs.forEach(config => out[config.key] = config.value);
    return out;
  }

  public savePluginConfigs(name: string, data: Record<string, any>) {
    if (!this.applications.has(name)) throw new HttpNotFoundException('找不到插件');
    const state = this.applications.get(name);
    if (!state.plugin_configs) state.plugin_configs = [];
    const dictionary = resolve(this.HOME, 'node_modules', name);
    const pkgfilename = resolve(dictionary, 'package.json');
    if (!existsSync(pkgfilename)) throw new HttpNotFoundException('找不到插件信息文件');
    state.plugin_configs.forEach(config => config.value = data[config.key] === undefined ? null : data[config.key]);
    writeFileSync(pkgfilename, JSON.stringify(state, null, 2), 'utf8');
  }
}