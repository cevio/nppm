import { resolve } from 'path';
import { existsSync } from 'fs';
import { interfaces } from 'inversify';
import { Configs } from './configs';
import { spawn } from 'child_process';
import { Login } from './login';
import { effect } from '@vue/reactivity';
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

export * from './configs';
export * from './interface';
export * from './login';

export class NPMCore {
  public readonly orm = ORM_CONNECTION_CONTEXT;
  public readonly redis = REDIS_CONNECTION_CONTEXT;
  public readonly http = HTTP_APPLICATION_CONTEXT;
  public readonly server = HTTP_SERVER_CONTEXT;
  public readonly HOME = isProduction ? process.cwd() : process.env.HOME;
  public readonly configs = new Configs(this.HOME);
  private readonly entities = new Set<interfaces.Newable<any>>();
  private readonly applications = new Map<string, TApplicationPackageJSONState>();
  private readonly logins = new Map<string, Login>();

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
            this.installApplication(key).catch(e => logger.error(e));
          }
        }
      })
    }
  }

  private async installApplication(key: string) {
    if (this.applications.has(key)) return false;
    const dictionary = resolve(this.HOME, 'node_modules', key);
    const pkgfilename = resolve(dictionary, 'package.json');
    if (!existsSync(pkgfilename)) return;
    const pkg = require(pkgfilename) as TApplicationPackageJSONState;
    if (!pkg.nppm) return false;
    const application = require(!isProduction ? resolve(dictionary, pkg.devmain) : dictionary);
    const installer = (application.default || application) as TApplication;
    pkg._uninstall = await Promise.resolve(installer(this, key));
    this.applications.set(key, pkg);
    return true;
  }

  public async install(app: string, registry?: string) {
    const key = await new Promise<string>((resolved, reject) => {
      const args: string[] = ['install', app];
      if (registry) args.push('--registry=' + registry);
      const ls = spawn('npm', args, { cwd: this.HOME })
      ls.on('exit', code => {
        if (code !== 0) return reject(new Error('application ' + app + ' install failed.'));
        if (existsSync(app)) {
          const pkgfilename = resolve(app, 'package.json');
          const pkg = require(pkgfilename);
          return resolved(pkg.name);
        }
        resolved(app);
      })
    })
    return await this.installApplication(key);
  }

  public uninstall(app: string) {
    if (!this.applications.has(app)) return;
    return new Promise<void>((resolved, reject) => {
      const ls = spawn('npm', ['uninstall', app], { cwd: this.HOME })
      ls.on('exit', code => {
        if (code !== 0) return reject(new Error('application ' + app + ' uninstall failed.'));
        this.applications.delete(app);
        resolved();
      })
    })
  }

  public createLoginModule(name: string) {
    return new Login(name);
  }

  public addLoginModule(login: Login) {
    this.logins.set(login.namespace, login);
    return this;
  }

  public hasLoginModule(name: string) {
    return this.logins.has(name);
  }

  public getLoginModule(name: string) {
    return this.logins.get(name);
  }
}