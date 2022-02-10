import { resolve } from 'path';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { VersionEntity, DowloadEntity } from '@nppm/entity';
import { createReadStream } from 'fs-extra';
import { HttpNotFoundException } from '@typeservice/exception';
import { 
  HTTPController, 
  HTTPRouter, 
  HTTPRouterMiddleware, 
  HTTPRequestParam 
} from '@typeservice/http';
import { 
  createNPMErrorCatchMiddleware, 
  NpmCommanderLimit, 
  OnlyRunInCommanderLineInterface, 
} from '@nppm/utils';

@HTTPController()
export class HttpPackageDownloadService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  /**
   * 获取下载模块的内容buffer
   * @param key 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/download/:rev.tgz',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('install', 'docs'))
  public async download(@HTTPRequestParam('rev') key: string) {
    const Version = this.connection.getRepository(VersionEntity);
    const Download = this.connection.getRepository(DowloadEntity);
    const version = await Version.findOne({ rev: key });
    if (!version) throw new HttpNotFoundException();
    const HOME = this.npmcore.HOME;
    const configs = await ConfigCacheAble.get(null, this.connection);
    const file = resolve(HOME, configs.dictionary || 'packages', version.tarball);
    await Download.insert({ vid: version.id, pid: version.pid, gmt_create: new Date() });
    return createReadStream(file);
  }
}