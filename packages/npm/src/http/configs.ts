import * as dayjs from 'dayjs';
import { inject } from 'inversify';
import { ConfigCacheAble } from '@nppm/cache';
import { NPMCore } from '@nppm/core';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestBody } from '@typeservice/http';
import { UserInfoMiddleware, UserMustBeAdminMiddleware, UserMustBeLoginedMiddleware, UserNotForbiddenMiddleware } from '@nppm/utils';
import { ConfigEntity, PackageEntity, UserEntity, VersionEntity, DowloadEntity, StarEntity } from '@nppm/entity';
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
  registerable: boolean,
  installable: boolean,
  ips: string[],
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
    configs.installable = body.installable;
    configs.ips = body.ips;
    configs = await Configs.save(configs);
    const result = await ConfigCacheAble.build(null, this.connection);
    this.npmcore.emit('config:update', result);
    return result;
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

  @HTTPRouter({
    pathname: '/~/dashboard/users',
    methods: 'GET'
  })
  public async dashboardUsers() {
    const User = this.connection.getRepository(UserEntity);
    const count = await User.count();
    const seven = await User.createQueryBuilder('user')
      .where('user.gmt_create>=:today', { 
        today: dayjs(dayjs().add(-7, 'days').format('YYYY-MM-DD') + ' 00:00:00').toDate() 
      })
      .getCount();
    return {
      count, seven,
    }
  }

  @HTTPRouter({
    pathname: '/~/dashboard/packages',
    methods: 'GET'
  })
  public async dashboardPackages() {
    const Packages = this.connection.getRepository(PackageEntity);
    const count = await Packages.count();
    const seven = await Packages.createQueryBuilder('pack')
      .leftJoin(VersionEntity, 'version', 'version.pid=pack.id')
      .select('pack.id')
      .where('version.gmt_modified>=:today', { 
        today: dayjs(dayjs().add(-7, 'days').format('YYYY-MM-DD') + ' 00:00:00').toDate() 
      })
      .distinct(true)
      .getCount();
    return {
      count, seven,
    }
  }

  @HTTPRouter({
    pathname: '/~/dashboard/stars',
    methods: 'GET'
  })
  public async dashboardStars() {
    const Star = this.connection.getRepository(StarEntity);
    const count = await Star.count();
    const seven = await Star.createQueryBuilder('star')
      .where('star.gmt_create>=:today', { 
        today: dayjs(dayjs().add(-7, 'days').format('YYYY-MM-DD') + ' 00:00:00').toDate() 
      })
      .getCount();
    return {
      count, seven,
    }
  }

  @HTTPRouter({
    pathname: '/~/dashboard/downloads',
    methods: 'GET'
  })
  public async dashboardDowloads() {
    const Download = this.connection.getRepository(DowloadEntity);
    const count = await Download.count();
    const seven = await Download.createQueryBuilder('download')
      .where('download.gmt_create>=:today', { 
        today: dayjs(dayjs().add(-7, 'days').format('YYYY-MM-DD') + ' 00:00:00').toDate() 
      })
      .getCount();
    return {
      count, seven,
    }
  }
}