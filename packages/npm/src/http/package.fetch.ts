import axios, { AxiosResponse } from 'axios';
import { resolve as urlResolve } from 'url';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { PackageEntity } from '@nppm/entity';
import { HttpNotFoundException, HttpException } from '@typeservice/exception';
import { PackageCacheAble } from '@nppm/cache';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestParam, HTTPRequestQuery } from '@typeservice/http';
import { createNPMErrorCatchMiddleware, OnlyRunInCommanderLineInterface, UserInfoMiddleware, UserMustBeLoginedMiddleware, UserNotForbiddenMiddleware } from '@nppm/utils';

@HTTPController()
export class HttpPackageFetchService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  private readonly NotFoundResponse = 'not found';
  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  /**
   * 获取模块信息 - 仅命令行
   * @param pkg 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/:pkg',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  public async readPackage(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestQuery('registry') registry?: string,
  ) {
    const Packages = this.connection.getRepository(PackageEntity);
    const pack = await Packages.findOne({ pathname: pkg });
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (pack && pack.is_private) {
      const result = await PackageCacheAble.get({ pkg }, this.connection);
      const versions = result.versions;
      for (const key in versions) {
        versions[key].dist.tarball = urlResolve(configs.domain, versions[key].dist.tarball);
      }
      return this.wrapPackage(result, true);
    }
    const res = await (registry ? [registry] : configs.registries).reduce<Promise<AxiosResponse<any>>>((prev, registry) => {
      return prev.then((res) => {
        const state = res.data;
        if (state.error) return Promise.reject(new HttpNotFoundException(this.NotFoundResponse));
        return res;
      }).catch((e: HttpException) => {
        if (e.status === 404) {
          return axios.get(urlResolve(registry, pkg)).catch(e => Promise.reject(new HttpNotFoundException(this.NotFoundResponse)));
        }
        return Promise.reject(e);
      })
    }, Promise.reject(new HttpNotFoundException(this.NotFoundResponse)));
    return this.wrapPackage(res.data, false);
  }

  private wrapPackage(res: any, isNppm: boolean) {
    return Object.assign(res, { _nppm: isNppm });
  }

  /**
   * 获取带命名空间的模块信息 - 整个
   * @param scope 
   * @param pkg 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/package/@:scope/:pkg',
    methods: 'GET'
  })
  public readWebScopedPackage(
    @HTTPRequestParam('scope') scope: string,
    @HTTPRequestParam('pkg') pkg: string,
  ) {
    return this.readPackage('@' + scope + '/' + pkg, 'https://registry.npmjs.org/');
  }

  /**
   * 获取带命名空间的模块信息 - 版本
   * @param scope 
   * @param pkg 
   * @param version 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/package/@:scope/:pkg/:version',
    methods: 'GET'
  })
  public async readWebScopedPackageVersion(
    @HTTPRequestParam('scope') scope: string,
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestParam('version') version: string,
  ) {
    const state = await this.readWebScopedPackage(scope, pkg);
    const tagVersion = state['dist-tags'][version];
    return tagVersion ? state.versions[tagVersion] : state.versions[version];
  }

  /**
   * 获取普通模块信息 - 整个
   * @param pkg 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/package/:pkg',
    methods: 'GET'
  })
  public readWebNormalPackage(@HTTPRequestParam('pkg') pkg: string) {
    return this.readPackage(pkg, 'https://registry.npmjs.org/');
  }

  /**
   * 获取普通模块信息 - 版本
   * @param pkg 
   * @param version 
   * @returns 
   */
   @HTTPRouter({
    pathname: '/~/package/:pkg/:version',
    methods: 'GET'
  })
  public async readWebNormalPackageVersion(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestParam('version') version: string
  ) {
    const state = await this.readWebNormalPackage(pkg);
    const tagVersion = state['dist-tags'][version];
    return tagVersion ? state.versions[tagVersion] : state.versions[version];
  }
}