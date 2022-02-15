import { inject } from 'inversify';
import { ConfigCacheAble } from '@nppm/cache';
import { NPMCore } from '@nppm/core';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestBody } from '@typeservice/http';
import { UserInfoMiddleware, UserMustBeAdminMiddleware, UserMustBeLoginedMiddleware, UserNotForbiddenMiddleware } from '@nppm/utils';
import { ConfigEntity, PackageEntity, UserEntity, VersionEntity, DowloadEntity } from '@nppm/entity';
import { HttpNotAcceptableException } from '@typeservice/exception';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { HttpOKException } from '@typeservice/exception';
import { performance } from 'perf_hooks';

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
    pathname: '/-/ping',
    methods: 'GET'
  })
  public ping() {
    return performance.now();
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

  @HTTPRouter({
    pathname: '/~/dashboard',
    methods: 'GET'
  })
  public async dashboard() {
    const User = this.connection.getRepository(UserEntity);
    const Packages = this.connection.getRepository(PackageEntity);
    const Version = this.connection.getRepository(VersionEntity);
    const Download = this.connection.getRepository(DowloadEntity);
    const [user, pack, version, downloads] = await Promise.all([
      User.count(),
      Packages.count(),
      Version.count(),
      Download.count(),
    ])
    return {
      userCount: user,
      packageCount: pack,
      versionCount: version,
      downloadCount: downloads,
    }
  }

  @HTTPRouter({
    pathname: '/',
    methods: 'GET'
  })
  public theme() {
    const e = new HttpOKException(readFileSync(resolve(__dirname, '../../theme/index.html')));
    e.set('content-type', 'text/html')
    throw e;
  }
}