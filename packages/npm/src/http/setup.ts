import { inject } from 'inversify';
import { ConfigCacheAble, UserCountCacheAble } from '@nppm/cache';
import { ConfigEntity, UserEntity } from '@nppm/entity';
import { NPMCore } from '@nppm/core';
import { HttpNotAcceptableException, HttpNotFoundException } from '@typeservice/exception';
import { HTTPController, HTTPRouter, HTTPRequestBody, HTTPRouterMiddleware, HTTPRequestState } from '@typeservice/http';
import { ORM_CONNECTION_CONTEXT, REDIS_CONNECTION_CONTEXT, TORMConfigs, TCreateRedisServerProps, UserInfoMiddleware, UserMustBeLoginedMiddleware, UserNotForbiddenMiddleware, UserMustBeAdminMiddleware } from '@nppm/utils';

@HTTPController()
export class HttpSetupService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  /**
   * 获取当前安装步骤
   * @returns 0 | 1 | 2 | 3
   */
  @HTTPRouter({
    pathname: '/~/setup/mode',
    methods: 'GET'
  })
  public async getWebsiteMode() {
    if (!this.connection) return 1;
    if (!this.redis) return 2;
    const count = await UserCountCacheAble.get(null, this.connection);
    if (count === 0) return 3;
    return 0;
  }

  /**
   * 获取ORM存储数据
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/setup/orm',
    methods: 'GET'
  })
  public getORMState() {
    return this.npmcore.configs.value.orm;
  }

  /**
   * 设置ORM存储数据
   * 安装模式
   * @param body 
   * @param user 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/setup/orm',
    methods: 'POST'
  })
  public async setORMState(@HTTPRequestBody() body: TORMConfigs) {
    const mode = await this.getWebsiteMode();
    if (mode !== 1) throw new HttpNotFoundException();
    return await this.setORMStateWithAdmin(body);
  }

  /**
   * 设置ORM存储数据
   * 管理员模式
   * @param body 
   * @param user 
   * @returns 
   */
   @HTTPRouter({
    pathname: '/~/setup/orm',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async setORMStateWithAdmin(
    @HTTPRequestBody() body: TORMConfigs, 
    @HTTPRequestState('user') user?: UserEntity
  ) {
    const rollback = this.npmcore.configs.updateORMState(body);
    const status = await this.checkStatus(() => !!ORM_CONNECTION_CONTEXT.value, 1000, 30 * 1000);
    if (status) {
      const ConfigRepository = this.connection.getRepository(ConfigEntity);
      let configs = await ConfigRepository.findOne();
      if (!configs) {
        const _configs = new ConfigEntity();
        _configs.domain = 'http://127.0.0.1:3000';
        _configs.login_code = 'default';
        _configs.registries = ["https://registry.npm.taobao.org/", "https://registry.npmjs.org/"];
        _configs.scopes = [];
        _configs.dictionary = 'node_packages';
        _configs.registerable = true;
        await ConfigRepository.save(_configs);
        if (user && user.admin) {
          await ConfigCacheAble.build(null, this.connection);
        }
      }
    } else {
      rollback();
    }
    return status;
  }

  /**
   * 设置REDIS存储数据
   * 安装模式
   * @param body 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/setup/redis',
    methods: 'POST'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  public async setRedisState(@HTTPRequestBody() body: TCreateRedisServerProps) {
    const mode = await this.getWebsiteMode();
    if (mode !== 2) throw new HttpNotFoundException();
    return await this.setRedisStateWithAdmin(body);
  }

  /**
   * 设置REDIS存储数据
   * 管理员模式
   * @param body 
   * @returns 
   */
   @HTTPRouter({
    pathname: '/~/setup/redis',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async setRedisStateWithAdmin(@HTTPRequestBody() body: TCreateRedisServerProps) {
    if (!body.host || !body.port) throw new HttpNotAcceptableException('redis地址和redis端口必填');
    const rollback = this.npmcore.configs.updateRedisState(body);
    const status = await this.checkStatus(() => !!REDIS_CONNECTION_CONTEXT.value, 1000, 30 * 1000);
    if (status) {
      await ConfigCacheAble.build(null, this.connection);
    } else {
      rollback();
    }
    return status;
  }

  /**
   * 获取REDIS存储数据
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/setup/redis',
    methods: 'GET'
  })
  public getRedisState() {
    return this.npmcore.configs.value.redis;
  }

  private checkStatus(fn: () => boolean, step: number, timeout: number) {
    const nextTime = Date.now() + timeout;
    return new Promise<boolean>((resolve) => {
      const timer = setInterval(() => {
        if (Date.now() >= nextTime) {
          clearInterval(timer);
          return resolve(false);
        }
        if (fn()) return resolve(true);
      }, step);
    })
  }
}