import { resolve } from 'url';
import { url } from 'gravatar';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { generate } from 'randomstring';
import { UserEntity } from '@nppm/entity';
import { NPMSession, NpmCommanderLimit, OnlyRunInCommanderLineInterface } from '@nppm/utils';
import { UserCacheAble, UserCountCacheAble, ConfigCacheAble } from '@nppm/cache';
import { HTTPController, HTTPRouter, HTTPRequestBody, HTTPRouterMiddleware } from '@typeservice/http';
import { 
  HttpNotAcceptableException, 
  HttpNotFoundException, 
  HttpServiceUnavailableException, 
  HttpUnprocessableEntityException,
  HttpForbiddenException,
  HttpUnauthorizedException
} from '@typeservice/exception';

@HTTPController()
export class HttpUserService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/~/user',
    methods: 'POST'
  })
  public async createInstalizeUser(@HTTPRequestBody() body: { username: string, password: string, email: string }) {
    const User = this.connection.getRepository(UserEntity);
    const count = await User.count();
    if (count !== 0) throw new HttpNotAcceptableException('非法操作');
    const user = await this.createNewUser(body.username, body.password, body.email, 'default', true);
    await this.redis.set('npm:user:Basic:' + Buffer.from(user.account + ':' + user.password).toString('base64'), JSON.stringify(user));
    await UserCountCacheAble.build(null, this.connection);
    return await UserCacheAble.build({ id: user.id }, this.connection);
  }

  @HTTPRouter({
    pathname: '/-/v1/login',
    methods: 'POST'
  })
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('adduser'))
  public async checkUserLoginType(
    @NPMSession() session: string,
    @HTTPRequestBody() body: { hostname: string }
  ) {
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (!configs.login_code || configs.login_code === 'default') {
      throw new HttpNotFoundException('Using default login type.');
    }
    if (!this.npmcore.hasLoginModule(configs.login_code)) {
      throw new HttpServiceUnavailableException('服务端未安装对应登录插件');
    }
    const key = this.toAuthorizeKey(session);
    await this.redis.set(key, body.hostname);
    await this.redis.expire(key, 300);
    return {
      loginUrl: resolve(configs.domain, '/~/v1/login/authorize?session=' + session),
      doneUrl: resolve(configs.domain, '/~/v1/login/checkable?session=' + session),
    }
  }

  @HTTPRouter({
    pathname: '/-/user/org.couchdb.user:account',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('adduser'))
  public async createUserBasedLoginModule(
    @HTTPRequestBody() body: { _id: string, name: string, password: string, type: string, roles: string[], data: string, email?: string }
  ) {
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (configs.login_code !== 'default') {
      throw new HttpUnprocessableEntityException('服务端不接受此登录方式，请联系管理员。');
    }
    if (!body.email) throw new HttpNotFoundException();
    const User = this.connection.getRepository(UserEntity);
    let user = await User.findOne({
      account: body.name,
      login_code: 'default',
    })
    if (user) {
      if (user.login_forbiden) throw new HttpForbiddenException();
      if (!this.checkPassowrd(body.password, user.salt, user.password)) throw new HttpUnauthorizedException();;
      const updateHash = this.getPasswordAndSalt(body.password);
      user.salt = updateHash.salt;
      user.password = updateHash.password;
      user.gmt_modified = new Date();
      user = await User.save(user);
    } else {
      user = await this.createNewUser(body.name, body.password, body.email, 'default', false);
    }

    await this.redis.set('npm:user:Basic:' + Buffer.from(user.account + ':' + user.password).toString('base64'), JSON.stringify(user));
    await UserCountCacheAble.build(null, this.connection);
    await UserCacheAble.build({ id: user.id }, this.connection);

    return {
      ok: true,
      id: 'org.couchdb.user:' + body.name,
    }
  }

  private toAuthorizeKey(session: string) {
    return 'npm:login:' + session;
  }

  private createNewUser(account: string, password: string, email: string, login_code: string, isAdmin: boolean) {
    const User = this.connection.getRepository(UserEntity);
    const insertHash = this.getPasswordAndSalt(password);
    let user = new UserEntity();
    user.salt = generate(5);
    user.salt = insertHash.salt;
    user.account = account;
    user.avatar = url(email);
    user.email = email;
    user.gmt_create = new Date();
    user.gmt_modified = new Date();
    user.login_code = login_code;
    user.login_forbiden = false;
    user.nickname = account;
    user.scopes = [];
    user.admin = isAdmin;
    user.password = insertHash.password;
    return User.save(user);
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