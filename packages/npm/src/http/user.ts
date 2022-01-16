import { resolve, URL } from 'url';
import { url } from 'gravatar';
import { nanoid } from 'nanoid';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { generate } from 'randomstring';
import { UserEntity } from '@nppm/entity';
import { UserCacheAble, UserCountCacheAble, ConfigCacheAble } from '@nppm/cache';
import { 
  HTTPController, 
  HTTPRouter, 
  HTTPRequestBody, 
  HTTPRouterMiddleware, 
  HTTPRequestQuery, 
  HTTPRequestState, 
  HTTPRequestParam,
  HTTPCookie,
  TCookie,
} from '@typeservice/http';
import { 
  NPMSession, 
  NpmCommanderLimit, 
  OnlyRunInCommanderLineInterface, 
  UserInfoMiddleware, 
  UserMustBeLoginedMiddleware, 
  UserNotForbiddenMiddleware, 
  createNPMErrorCatchMiddleware, 
  logger
} from '@nppm/utils';
import { 
  HttpNotAcceptableException, 
  HttpNotFoundException, 
  HttpServiceUnavailableException, 
  HttpUnprocessableEntityException,
  HttpForbiddenException,
  HttpUnauthorizedException,
  HttpMovedPermanentlyException,
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
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
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
      throw new HttpServiceUnavailableException('服务端未安装对应登录插件:' + configs.login_code);
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
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
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

  @HTTPRouter({
    pathname: '/~/v1/login/authorize',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  public async getLoginRedirectContent(@HTTPRequestQuery('session') session: string) {
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (!configs.login_code || configs.login_code === 'default') {
      throw new HttpNotFoundException('Using default login type.');
    }
    if (!this.npmcore.hasLoginModule(configs.login_code)) {
      throw new HttpServiceUnavailableException('服务端未安装对应登录插件:' + configs.login_code);
    }
    const login = this.npmcore.getLoginModule(configs.login_code);
    const url = await login.authorize(session);
    throw new HttpMovedPermanentlyException(url);
  }

  @HTTPRouter({
    pathname: '/~/v1/login/checkable',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  public async checkLoginRedirectContent(
    @HTTPRequestQuery('session') session: string,
    @HTTPRequestQuery('redirect') redirect: string,
    @HTTPCookie() cookie: TCookie,
  ) {
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (!configs.login_code || configs.login_code === 'default') {
      throw new HttpNotFoundException('Using default login type.');
    }
    if (!this.npmcore.hasLoginModule(configs.login_code)) {
      throw new HttpServiceUnavailableException('服务端未安装对应登录插件:' + configs.login_code);
    }
    const login = this.npmcore.getLoginModule(configs.login_code);
    const result = await login.checkable(session);

    const User = this.connection.getRepository(UserEntity);
    let user = await User.findOne({ account: result.account });
    if (user) {
      if (user.login_forbiden) throw new HttpForbiddenException('此用户禁止登录');
      user.avatar = result.avatar;
      user.email = result.email;
      user.nickname = result.nickname;
      user.password = result.token;
      user.gmt_modified = new Date();
    } else {
      user = new UserEntity();
      user.salt = generate(5);
      user.account = result.account;
      user.avatar = result.avatar;
      user.email = result.email;
      user.gmt_create = new Date();
      user.gmt_modified = new Date();
      user.login_code = configs.login_code;
      user.login_forbiden = false;
      user.nickname = result.nickname;
      user.scopes = [];
      user.password = result.token;
    }
    user = await User.save(user);
    await this.redis.set('npm:user:Bearer:' + result.token, JSON.stringify(user));
    await UserCountCacheAble.build(null, this.connection);
    await UserCacheAble.build({ id: user.id }, this.connection);
    if (redirect) {
      await this.setUserCookie(cookie, user, 'Bearer');
      throw new HttpMovedPermanentlyException(redirect);
    } else {
      return result;
    }
  }

  @HTTPRouter({
    pathname: '/-/whoami',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('whoami'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public whoami(@HTTPRequestState('user') user: UserEntity) {
    return {
      username: user ? user.nickname : null,
    }
  }

  @HTTPRouter({
    pathname: '/-/user/token/:token',
    methods: 'DELETE'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('logout'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async logout(@HTTPRequestParam('token') token: string) {
    if (token) {
      const key = 'npm:user:Bearer:' + token;
      if (await this.redis.exists(key)) {
        await this.redis.del(key);
      }
    }
    return {
      ok: true,
    }
  }

  @HTTPRouter({
    pathname: '/~/webLogin',
    methods: 'POST'
  })
  public async webLogin(
    @HTTPRequestQuery('type') type: string,
    @HTTPRequestBody() body: { username?: string, password?: string, redirect?: string },
    @HTTPCookie() cookie: TCookie,
  ) {
    switch (type) {
      case 'default':
        if (!body.username || !body.password) throw new HttpNotAcceptableException('缺少账号密码');
        const User = this.connection.getRepository(UserEntity);
        let user = await User.findOne({ account: body.username });
        if (!user) throw new HttpNotFoundException('找不到用户');
        if (!this.checkPassowrd(body.password, user.salt, user.password)) throw new HttpForbiddenException('账号密码不正确');
        const updateHash = this.getPasswordAndSalt(body.password);
        user.salt = updateHash.salt;
        user.password = updateHash.password;
        user.gmt_modified = new Date();
        user = await User.save(user);
        await this.redis.set('npm:user:Basic:' + Buffer.from(user.account + ':' + user.password).toString('base64'), JSON.stringify(user));
        await UserCountCacheAble.build(null, this.connection);
        user = await UserCacheAble.build({ id: user.id }, this.connection);
        await this.setUserCookie(cookie, user, 'Basic');
        delete user.salt;
        delete user.password;
        delete user.login_forbiden;
        return user;
      default:
        if (!body.redirect) throw new HttpNotAcceptableException('缺少回调页面');
        if (!this.npmcore.hasLoginModule(type)) {
          throw new HttpServiceUnavailableException('服务端未安装对应登录插件:' + type);
        }
        const session = nanoid();
        const key = this.toAuthorizeKey(session);
        const configs = await ConfigCacheAble.get(null, this.connection);
        const url = resolve(configs.domain, '/~/v1/login/checkable?session=' + encodeURIComponent(session) + '&redirect=' + encodeURIComponent(body.redirect));
        await this.redis.set(key, url);
        await this.redis.expire(key, 300);
        return {
          loginUrl: resolve(configs.domain, '/~/v1/login/authorize?session=' + session),
        }
    }
  }

  @HTTPRouter({
    pathname: '/~/webLogout',
    methods: 'DELETE'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async webLogout(
    @HTTPRequestState('token') token: string,
    @HTTPCookie() cookie: TCookie,
  ) {
    if (await this.redis.exists(token)) {
      await this.redis.del(token);
      cookie.set(token, null, { 
        signed: true,
        path: '/',
        maxAge: -1,
        expires: new Date(0),
      })
      return;
    }
    throw new HttpForbiddenException('找不到退出用户');
  }

  @HTTPRouter({
    pathname: '/~/user',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  public getUserInfo(@HTTPRequestState('user') user: UserEntity) {
    if (user) {
      delete user.salt;
      delete user.password;
      delete user.login_forbiden;
      return user;
    } else {
      return {
        id: 0,
        account: null,
        nickname: null,
        email: null,
        login_code: 'default',
        avatar: null,
        scopes: [],
        admin: false,
        gmt_create: new Date(),
        gmt_modified: new Date(),
      } as UserEntity
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

  private async setUserCookie(cookie: TCookie, user: UserEntity, type: 'Basic' | 'Bearer') {
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + maxAge);
    const hash = type === 'Basic' ? Buffer.from(user.account + ':' + user.password).toString('base64') : user.password;
    cookie.set('authorization', type + ' ' + hash, { 
      signed: true,
      path: '/',
      // domain: '.' + obj.hostname,
      maxAge,
      expires,
    });
    return user;
  }
}