import axios, { AxiosResponse } from 'axios';
import { resolve as urlResolve } from 'url';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { PackageEntity } from '@nppm/entity';
import { HttpNotFoundException, HttpException } from '@typeservice/exception';
import { PackageCacheAble } from '@nppm/cache';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestParam } from '@typeservice/http';
import { createNPMErrorCatchMiddleware, OnlyRunInCommanderLineInterface, UserInfoMiddleware, UserMustBeLoginedMiddleware } from '@nppm/utils';

@HTTPController()
export class HttpPackageFetchService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  private readonly NotFoundResponse = 'not found';
  get connection() {
    return this.npmcore.orm.value;
  }

  /**
   * 获取模块信息
   * @param pkg 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/:pkg',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  public async readPackage(@HTTPRequestParam('pkg') pkg: string) {
    const Packages = this.connection.getRepository(PackageEntity);
    const pack = await Packages.findOne({ pathname: pkg });
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (pack && pack.is_private) {
      const result = await PackageCacheAble.get({ pkg }, this.connection);
      const versions = result.versions;
      for (const key in versions) {
        versions[key].dist.tarball = urlResolve(configs.domain, versions[key].dist.tarball);
      }
      return result;
    }
    const res = await configs.registries.reduce<Promise<AxiosResponse<any>>>((prev, registry) => {
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
    return res.data;
  }
}