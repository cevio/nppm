import { resolve } from 'url';
import { FindManyOptions, Like } from 'typeorm';
import { url } from 'gravatar';
import { nanoid } from 'nanoid';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
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
  UserMustBeAdminMiddleware
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

type TLoginType = 'Basic' | 'Bearer';

@HTTPController()
export class HttpUserService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  private async insertUser<T extends Omit<Partial<UserEntity>, 'id'>>(state: T, type: TLoginType) {
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (!configs.registerable) throw new HttpForbiddenException('npm stop register');
    const user = new UserEntity();
    return this.updateUser(user, state, type);
  }

  private async updateUser<T extends Omit<Partial<UserEntity>, 'id'>>(user: UserEntity, state: T, type: TLoginType) {
    const User = this.connection.getRepository(UserEntity);
    for (const key in state) {
      if (Object.prototype.hasOwnProperty.call(state, key)) {
        // @ts-ignore
        user[key] = state[key];
      }
    }
    if (type === 'Basic') {
      if (state.account && state.password) {
        user.password = this.buildBasicPassword(state.account, state.password);
      }
    }
    user = await User.save(user);
    switch (type) {
      case 'Basic':
        await this.redis.set('npm:user:Basic:' + user.password, JSON.stringify(user));
        await this.redis.expire('npm:user:Basic:' + user.password, 7 * 24 * 60 * 60);
        break;
      case 'Bearer':
        await this.redis.set('npm:user:Bearer:' + user.password, JSON.stringify(user));
        await this.redis.expire('npm:user:Bearer:' + user.password, 7 * 24 * 60 * 60);
        break;
    }
    await UserCountCacheAble.build(null, this.connection);
    return await UserCacheAble.build({ id: user.id }, this.connection);
  }

  @HTTPRouter({
    pathname: '/~/user',
    methods: 'POST'
  })
  public async createInstalizeUser(@HTTPRequestBody() body: { username: string, password: string, email: string }) {
    const User = this.connection.getRepository(UserEntity);
    const count = await User.count();
    if (count !== 0) throw new HttpNotAcceptableException('非法操作');
    return await this.insertUser({
      account: body.username,
      avatar: url(body.email),
      email: body.email,
      gmt_create: new Date(),
      gmt_modified: new Date(),
      login_code: 'default',
      login_forbiden: false,
      nickname: body.username,
      scopes: [],
      admin: true,
      password: body.password,
    }, 'Basic');
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
    @HTTPRequestBody() body: { 
      _id: string, 
      name: string, 
      password: string, 
      type: string, 
      roles: string[], 
      data: string, 
      email?: string 
    }
  ) {
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (configs.login_code !== 'default') {
      throw new HttpUnprocessableEntityException('服务端不接受此登录方式，请联系管理员。');
    }
    if (!body.email) throw new HttpNotFoundException();
    const User = this.connection.getRepository(UserEntity);
    let user = await User.findOne({ account: body.name, login_code: 'default' });
    if (user) {
      if (user.login_forbiden) throw new HttpForbiddenException();
      const base64 = this.buildBasicPassword(body.name, body.password);
      if (base64 !== user.password) throw new HttpUnauthorizedException();
      user = await this.updateUser(user, { gmt_modified: new Date() }, 'Basic');
    } else {
      user = await this.insertUser({
        account: body.name,
        avatar: url(body.email),
        email: body.email,
        gmt_create: new Date(),
        gmt_modified: new Date(),
        login_code: 'default',
        login_forbiden: false,
        nickname: body.name,
        scopes: [],
        admin: false,
        password: body.password,
      }, 'Basic');
    }

    this.npmcore.emit('login', user);

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
      user = await this.updateUser(user, {
        avatar: result.avatar,
        email: result.email,
        nickname: result.nickname,
        password: result.token,
        gmt_modified: new Date()
      }, 'Bearer')
    } else {
      user = await this.insertUser({
        account: result.account,
        avatar: result.avatar,
        email: result.email,
        gmt_create: new Date(),
        gmt_modified: new Date(),
        login_code: configs.login_code,
        login_forbiden: false,
        nickname: result.nickname,
        scopes: [],
        password: result.token,
      }, 'Bearer');
    }

    this.npmcore.emit('login', user);

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
      username: !user 
        ? null
        : user.login_code === 'default'
          ? user.account
          : user.nickname + '(' + user.account + ')'
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
        const user = await this.redis.get(key);
        await this.redis.del(key);
        this.npmcore.emit('logout', JSON.parse(user));
      }
    }
    // this.npmcore.emit('logout', user);
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
        if (this.buildBasicPassword(body.username, body.password) !== user.password) throw new HttpForbiddenException('账号密码不正确');
        await this.updateUser(user, { gmt_modified: new Date() }, 'Basic');
        await this.setUserCookie(cookie, user, 'Basic');
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
      const user = await this.redis.get(token);
      await this.redis.del(token);
      cookie.set(token, null, { 
        signed: true,
        path: '/',
        maxAge: -1,
        expires: new Date(0),
      })
      this.npmcore.emit('logout', JSON.parse(user));
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

  @HTTPRouter({
    pathname: '/~/user/:id',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async getUserById(@HTTPRequestParam('id') uid: string) {
    const User = this.connection.getRepository(UserEntity);
    const user = await User.findOne({ account: uid });
    if (!user) throw new HttpNotFoundException('找不到用户');
    delete user.password;
    delete user.login_forbiden;
    return user;
  }

  @HTTPRouter({
    pathname: '/~/users',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async getUsers(
    @HTTPRequestQuery('page') page: string,
    @HTTPRequestQuery('size') size: string,
    @HTTPRequestQuery('keyword') keyword: string,
  ) {
    const _page = Number(page || '1');
    const _size = Number(size || '10');
    const User = this.connection.getRepository(UserEntity);
    const conditions: FindManyOptions<UserEntity> = {
      skip: (_page - 1) * _size, 
      take: _size,
    }
    if (keyword) {
      conditions.where = [
        { account: Like('%' + keyword + '%') },
        { nickname: Like('%' + keyword + '%') },
      ]
    }
    return await User.findAndCount(conditions);
  }

  @HTTPRouter({
    pathname: '/~/user/:uid(\\d+)/admin',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async changeUserAdminStatus(
    @HTTPRequestParam('uid') uid: string,
    @HTTPRequestBody() body: { value: boolean },
    @HTTPRequestState('user') me: UserEntity,
  ) {
    if (me.id === Number(uid)) throw new HttpNotAcceptableException('不能操作自己');
    const User = this.connection.getRepository(UserEntity);
    let user = await User.findOne({ id: Number(uid) });
    if (!user) throw new HttpNotFoundException('找不到用户');
    return await this.updateUser(user, { admin: body.value }, user.login_code === 'default' ? 'Basic' : 'Bearer');
  }

  @HTTPRouter({
    pathname: '/~/user/:uid(\\d+)/forbidden',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async changeUserAdminForbiddenStatus(
    @HTTPRequestParam('uid') uid: string,
    @HTTPRequestBody() body: { value: boolean },
    @HTTPRequestState('user') me: UserEntity,
  ) {
    if (me.id === Number(uid)) throw new HttpNotAcceptableException('不能操作自己');
    const User = this.connection.getRepository(UserEntity);
    let user = await User.findOne({ id: Number(uid) });
    if (!user) throw new HttpNotFoundException('找不到用户');
    const result = await this.updateUser(user, { login_forbiden: body.value }, user.login_code === 'default' ? 'Basic' : 'Bearer');
    this.npmcore.emit('user:forbidden', user, body.value)
    return result;
  }

  @HTTPRouter({
    pathname: '/~/user/:uid(\\d+)',
    methods: 'DELETE'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async deleteUserByAdmin(
    @HTTPRequestParam('uid') uid: string,
    @HTTPRequestState('user') me: UserEntity,
  ) {
    if (me.id === Number(uid)) throw new HttpNotAcceptableException('不能操作自己');
    const User = this.connection.getRepository(UserEntity);
    let user = await User.findOne({ id: Number(uid) });
    if (!user) throw new HttpNotFoundException('找不到用户');
    await User.delete(Number(uid));
    const hash = user.login_code === 'default' ? 'npm:user:Basic:' + user.password : 'npm:user:Bearer:' + user.password;
    if (await this.redis.exists(hash)) await this.redis.del(hash);
    await UserCountCacheAble.build(null, this.connection);
    await UserCacheAble.del({ id: user.id });
    this.npmcore.emit('user:delete', user);
    return user;
  }

  private toAuthorizeKey(session: string) {
    return 'npm:login:' + session;
  }

  private buildBasicPassword(account: string, password: string) {
    return Buffer.from(account + ':' + password).toString('base64');
  }

  private async setUserCookie(cookie: TCookie, user: UserEntity, type: 'Basic' | 'Bearer') {
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + maxAge);
    cookie.set('authorization', type + ' ' + user.password, { 
      signed: true,
      path: '/',
      // domain: '.' + obj.hostname,
      maxAge,
      expires,
    });
    return user;
  }

  @HTTPRouter({
    pathname: '/-/npm/v1/user',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('profile'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public profile(@HTTPRequestState('user') user: UserEntity) {
    return {
      tfa: false,
      account: user.account,
      nickname: user.nickname,
      name: user.account,
      email: user.email,
      login_code: user.login_code,
      scopes: user.scopes,
      created: user.gmt_create,
      updated: user.gmt_modified
    }
  }

  @HTTPRouter({
    pathname: '/~/user/:id(\\d+)/scopes',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async setUserScopes(
    @HTTPRequestParam('id') id: string,
    @HTTPRequestBody() body: string[]
  ) {
    if (!Array.isArray(body)) throw new HttpNotAcceptableException('scopes必须为数组');
    const uid = Number(id);
    const User = this.connection.getRepository(UserEntity);
    const user = await User.findOne({ id: uid });
    if (!user) throw new HttpNotFoundException('找不到用户');
    user.scopes = body;
    await User.save(user);
    await UserCacheAble.build({ id: uid }, this.connection);
    return {
      ok: true,
    }
  }

  @HTTPRouter({
    pathname: '/~/likes',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  private async getMyLikes() {

  }
}