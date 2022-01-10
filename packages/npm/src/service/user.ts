import { Service, Public } from '@typeservice/radox';
import { ORMContext, RedisContext, RadoxContext } from '../effects';
import { ConfigCacheAble, UserCacheAble } from '../cache';
import { Exception } from '@typeservice/exception';
import { inject } from 'inversify';
import { HttpService } from './http';
import { resolve } from 'url';
import { UserEntity } from '@nppm/entity';
import { generate } from 'randomstring';
import { url } from 'gravatar';

@Service('com.nppm.user.service')
export class UserService {
  @inject(HttpService) private readonly HttpService: HttpService;

  get radox() {
    return RadoxContext.value;
  }

  get connection() {
    return ORMContext.value;
  }

  get redis() {
    return RedisContext.value;
  }

  private toAuthorizeKey(session: string) {
    return 'npm:login:' + session;
  }

  @Public()
  public async login(session: string, body?: { hostname: string }) {
    const configs = await ConfigCacheAble.get();
    if (!configs.login_code || configs.login_code === 'default') {
      throw new Exception(404, 'Using default login type.');
    }
    if (!session) throw new Exception(422, '请使用NPM的命令行工具登录');
    if (!this.HttpService.logins.has(configs.login_code)) throw new Exception(422, '服务端未安装对应登录插件');
    const key = this.toAuthorizeKey(session);
    await this.redis.set(key, body.hostname);
    await this.redis.expire(key, 300);
    return {
      loginUrl: resolve(configs.domain, '/~/v1/login/authorize?session=' + session),
      doneUrl: resolve(configs.domain, '/~/v1/login/checkable?session=' + session),
    }
  }

  public async authorize(session: string) {
    const key = this.toAuthorizeKey(session);
    if (!(await this.redis.exists(key))) {
      throw new Exception(425, '非法操作');
    }
    const configs = await ConfigCacheAble.get();
    const { auth } = this.HttpService.logins.get(configs.login_code);
    return await this.radox.sendback({
      command: auth.command,
      method: auth.method,
      arguments: [session, configs.domain],
    })
  }

  public async checkable(session: string) {
    const key = this.toAuthorizeKey(session);
    if (!(await this.redis.exists(key))) {
      throw new Exception(425, '非法操作');
    }
    const configs = await ConfigCacheAble.get();
    const { check } = this.HttpService.logins.get(configs.login_code);
    const { code, data, msg } = await this.radox.sendback({
      command: check.command,
      method: check.method,
      arguments: [session],
    })
    if (code === 1) {
      await this.redis.del(key);
      const repository = this.connection.getRepository(UserEntity);
      let user = await repository.findOne({ account: data.account });
      if (user) {
        if (user.login_forbiden) return { code: 401, msg: '禁止登录' }
        user.avatar = data.avatar;
        user.email = data.email;
        user.nickname = data.nickname;
        user.password = data.token;
        user.gmt_modified = new Date();
      } else {
        user = new UserEntity();
        user.salt = generate(5);
        user.account = data.account;
        user.avatar = data.avatar;
        user.email = data.email;
        user.gmt_create = new Date();
        user.gmt_modified = new Date();
        user.login_code = configs.login_code;
        user.login_forbiden = false;
        user.nickname = data.nickname;
        user.scopes = ['@node'];
        user.password = data.token;
      }
      const _user = await repository.save(user);
      await this.redis.set('npm:user:Bearer:' + data.token, JSON.stringify(_user));
      await UserCacheAble.build({ id: _user.id });
      return { code: 200, data }
    }
    
    if (code === 0) return { code: 202 }
    await this.redis.del(key);
    return { code: 500, msg };
  }

  @Public()
  public async basedLogin(account: string, password: string, email: string) {
    const User = this.connection.getRepository(UserEntity);
    let user = await User.findOne({
      account,
      login_code: 'default',
    })
    if (user) {
      if (user.login_forbiden) return 1;
      if (!this.checkPassowrd(password, user.salt, user.password)) return 2;
      const updateHash = this.getPasswordAndSalt(password);
      user.salt = updateHash.salt;
      user.password = updateHash.password;
      user.gmt_modified = new Date();
    } else {
      const insertHash = this.getPasswordAndSalt(password);
      user = new UserEntity();
      user.salt = insertHash.salt;
      user.account = account;
      user.avatar = url(email);
      user.email = email;
      user.gmt_create = new Date();
      user.gmt_modified = new Date();
      user.login_code = 'default';
      user.login_forbiden = false;
      user.nickname = account;
      user.scopes = ['@node'];
      user.password = insertHash.password;
    }
    const _user = await User.save(user);
    await this.redis.set('npm:user:Basic:' + Buffer.from(account + ':' + password).toString('base64'), JSON.stringify(_user));
    await UserCacheAble.build({ id: _user.id });
    return 0;
  }

  private getPasswordAndSalt(password: string) {
    const salt = generate(5);
    const hash = require('sha1')(salt + ':' + password);
    return {
      salt,
      password: hash,
    }
  }

  private checkPassowrd(password: string, salt: string, hash: string) {
    return require('sha1')(salt + ':' + password) === hash;
  }
}