import { inject } from 'inversify';
import { ConfigCacheAble } from '@nppm/cache';
import { NPMCore } from '@nppm/core';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestBody } from '@typeservice/http';
import { UserInfoMiddleware, UserMustBeAdminMiddleware, UserMustBeLoginedMiddleware, UserNotForbiddenMiddleware } from '@nppm/utils';
import { ConfigEntity } from '@nppm/entity';
import { HttpNotAcceptableException } from '@typeservice/exception';

export interface TConfigs {
  domain: string,
  scopes: string[],
  login_code: string,
  registries: string[],
  dictionary: string,
  registerable: boolean
}

@HTTPController()
export class HttpConfigsService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  @HTTPRouter({
    pathname: '/~/configs',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public getWebsiteConfigs() {
    return ConfigCacheAble.get(null, this.connection);
  }

  @HTTPRouter({
    pathname: '/~/configs',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async saveWebsiteConfigs(@HTTPRequestBody() body: TConfigs) {
    if (!body.domain || !body.registries.length || !body.login_code || !body.scopes.length) {
      throw new HttpNotAcceptableException('缺少必填参数');
    }
    const Configs = this.connection.getRepository(ConfigEntity);
    let configs = await Configs.findOne();
    if (!configs) configs = new ConfigEntity();
    configs.domain = body.domain;
    configs.login_code = body.login_code;
    configs.registries = body.registries;
    configs.scopes = body.scopes;
    configs.dictionary = body.dictionary;
    configs.registerable = body.registerable;
    configs = await Configs.save(configs);
    return await ConfigCacheAble.build(null, this.connection);
  }
}