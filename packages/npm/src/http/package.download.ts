import { resolve } from 'path';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { VersionEntity, DowloadEntity, PackageEntity, TagEntity, UserEntity } from '@nppm/entity';
import { createReadStream } from 'fs-extra';
import { HttpNotFoundException, HttpNotAcceptableException } from '@typeservice/exception';
import { 
  HTTPController, 
  HTTPRouter, 
  HTTPRouterMiddleware, 
  HTTPRequestParam,
  HTTPRequestQuery,
  HTTPRequestState,
} from '@typeservice/http';
import { 
  createNPMErrorCatchMiddleware, 
  OnlyRunInCommanderLineInterface,
  UserInfoMiddleware, 
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
  @HTTPRouterMiddleware(UserInfoMiddleware)
  public async download(
    @HTTPRequestParam('rev') key: string,
    @HTTPRequestState('user') user: UserEntity,
  ) {
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (!configs.installable) {
      if (!user) throw new HttpNotFoundException('不允许安装模块');
      if (user.login_forbiden) throw new HttpNotFoundException('不允许安装模块');
    }
    const Version = this.connection.getRepository(VersionEntity);
    const Download = this.connection.getRepository(DowloadEntity);
    const version = await Version.findOne({ rev: key });
    if (!version) throw new HttpNotFoundException();
    const HOME = this.npmcore.HOME;
    const file = resolve(HOME, configs.dictionary || 'packages', version.tarball);
    await Download.insert({ vid: version.id, pid: version.pid, gmt_create: new Date() });
    this.npmcore.emit('download', version);
    return createReadStream(file);
  }

  @HTTPRouter({
    pathname: '/~/downloads/rank',
    methods: 'GET'
  })
  public async starsRank(
    @HTTPRequestQuery('page') page: string = '1',
    @HTTPRequestQuery('size') size: string = '15',
  ) {
    type TPackage = {
      name: string,
      id: number,
      description: string,
      version: string,
      size: number,
      downloads: number,
      versions: number,
      maintainers: number,
      likes: number,
    }
    const _page = Number(page);
    const _size = Number(size);
    if (!_page || _page <= 0) throw new HttpNotAcceptableException('page invalid');
    if (!_size || _size <= 0) throw new HttpNotAcceptableException('size invalid');
    const Packages = this.connection.getRepository(PackageEntity);
    let builder = Packages.createQueryBuilder('pack')
      .leftJoin(VersionEntity, 'version', 'version.pid=pack.id')
      .leftJoin(TagEntity, 'tag', 'tag.vid=version.id')
      .leftJoin(DowloadEntity, 'download', 'download.vid=version.id')
      .select('pack.id', 'id')
      .addSelect('pack.pathname', 'name')
      .addSelect('version.description', 'description')
      .addSelect('version.code', 'version')
      .addSelect('version.attachment_size', 'size')
      .addSelect('COUNT(download.id)', 'downloads')
      .addSelect('pack.versions', 'versions')
      .addSelect('pack.maintainers', 'maintainers')
      .addSelect('pack.likes', 'likes')
      .andWhere('tag.vid=version.id')
      .andWhere(`tag.namespace='latest'`)
    builder = builder.groupBy('id, name, description, version, size, versions, maintainers, likes');
    const count = await builder.clone().getCount();
    builder = builder.orderBy({ 'downloads': 'DESC', 'pack.gmt_modified': 'DESC' }).offset((_page - 1) * _size).limit(_size);
    return [
      (await builder.getRawMany()) as TPackage[],
      count,
    ] as const;
  }
}