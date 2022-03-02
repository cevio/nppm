import axios from 'axios';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { Like } from 'typeorm'
import { PackageCacheAble } from '@nppm/cache';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestState, HTTPRequestQuery, HTTPRequestBody, HTTPRequestParam } from '@typeservice/http';
import { UserInfoMiddleware, UserMustBeLoginedMiddleware, UserNotForbiddenMiddleware } from '@nppm/utils';
import { MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity, DowloadEntity } from '@nppm/entity';
import { HttpNotAcceptableException, HttpNotFoundException, HttpForbiddenException } from '@typeservice/exception';

@HTTPController()
export class HttpPackageService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/~/user/:id(\\d+)/packages',
    methods: 'GET'
  })
  // @HTTPRouterMiddleware(UserInfoMiddleware)
  // @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  // @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async myPackages(
    @HTTPRequestParam('id') id: string,
    @HTTPRequestQuery('page') page: string,
    @HTTPRequestQuery('size') size: string,
    @HTTPRequestQuery('type') type: '0' | '1',
    @HTTPRequestQuery('keyword') keyword: string
  ) {
    const _uid = Number(id);
    const _page = Number(page);
    const _size = Number(size);
    const _type = Number(type) as 0 | 1;
    if (!_page || _page <= 0) throw new HttpNotAcceptableException('page invalid');
    if (!_size || _size <= 0) throw new HttpNotAcceptableException('size invalid');
    if (![0, 1].includes(_type)) throw new HttpNotAcceptableException('type invalid for 0 or 1');

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

    const Packages = this.connection.getRepository(PackageEntity);
    const Maintainer = this.connection.getRepository(MaintainerEntity);

    let builder = _type === 0
      ? Packages.createQueryBuilder('pack')
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
          .where('pack.uid=:uid', { uid: _uid })
          .andWhere('tag.vid=version.id')
          .andWhere(`tag.namespace='latest'`)
      : Maintainer.createQueryBuilder('maintainer')
          .leftJoin(PackageEntity, 'pack', 'pack.id=maintainer.pid')
          .leftJoin(VersionEntity, 'version', 'version.pid=pack.id')
          .leftJoin(DowloadEntity, 'download', 'download.vid=version.id')
          .leftJoin(TagEntity, 'tag', 'tag.vid=version.id')
          .select('pack.id', 'id')
          .addSelect('pack.pathname', 'name')
          .addSelect('version.description', 'description')
          .addSelect('version.code', 'version')
          .addSelect('version.attachment_size', 'size')
          .addSelect('COUNT(download.id)', 'downloads')
          .addSelect('pack.versions', 'versions')
          .addSelect('pack.maintainers', 'maintainers')
          .addSelect('pack.likes', 'likes')
          .addSelect('pack.gmt_modified', 'gmt_modified')
          .where('maintainer.uid=:uid', { uid: _uid })
          .andWhere('tag.vid=version.id')
          .andWhere(`tag.namespace='latest'`)
          .distinct(true);

    if (keyword) {
      builder = builder.andWhere('pack.pathname LIKE :keyword', { 
        keyword: '%' + keyword + '%' 
      });
    }

    builder = builder.groupBy('id, name, description, version, size, versions, maintainers, likes');

    const count = await builder.clone().getCount();

    builder = builder.orderBy({ 'pack.likes': 'DESC', 'pack.gmt_modified': 'DESC' }).offset((_page - 1) * _size).limit(_size);
    return [
      (await builder.getRawMany()) as TPackage[],
      count,
    ] as const;
  }

  /**
   * 转让管理员
   * @param id 
   * @param user 
   * @param body 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/packages/:id/transfer',
    methods: 'POST'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async transfer(
    @HTTPRequestParam('id') id: string,
    @HTTPRequestState('user') user: UserEntity,
    @HTTPRequestBody() body: { uid: number }
  ) {
    const Packages = this.connection.getRepository(PackageEntity);
    const pack = await Packages.findOne({ pathname: id });
    if (!pack) throw new HttpNotFoundException('cannot find the package id of ' + id);
    if (pack.uid !== user.id) throw new HttpForbiddenException('you are not the admin of this package');
    pack.uid = body.uid;
    pack.gmt_modified = new Date();
    await Packages.save(pack);
    const result = await PackageCacheAble.build({ pkg: pack.pathname }, this.connection);
    this.npmcore.emit('package:transfer', pack.pathname, body.uid, pack.uid);
    return result;
  }

  @HTTPRouter({
    pathname: '/~/package/:pkg/maintainers',
    methods: 'GET'
  })
  public async getPrivatePackageMaintainers(@HTTPRequestParam('pkg') pkg: string = ''): Promise<{ name: string, avatar: string, email: string }[]> {
    if (!pkg.startsWith('@') || !pkg.includes('/')) return [];
    const Packages = this.connection.getRepository(PackageEntity);
    const pack = await Packages.findOne({ pathname: pkg });
    if (!pack) return [];
    const Maintainer = this.connection.createQueryBuilder(MaintainerEntity, 'm')
      .leftJoin(UserEntity, 'u', 'u.id=m.uid')
      .select('u.nickname', 'name')
      .addSelect('u.email', 'email')
      .addSelect('u.avatar', 'avatar')
      .where('m.pid=:pid', { pid: pack.id });
    return await Maintainer.getRawMany();
  }

  @HTTPRouter({
    pathname: '/~/package/search',
    methods: 'GET'
  })
  public searchPackage(@HTTPRequestQuery('keyword') keyword: string) {
    const Packages = this.connection.getRepository(PackageEntity);
    return Packages.find({
      pathname: Like('%' + keyword + '%'),
    })
  }

  @HTTPRouter({
    pathname: '/~/package/update/recently',
    methods: 'GET'
  })
  public updateRecently(@HTTPRequestQuery('top') top: string) {
    const Packages = this.connection.getRepository(PackageEntity);
    return Packages.createQueryBuilder('pack')
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
      .addSelect('pack.gmt_modified', 'gmt_modified')
      .addSelect('pack.gmt_create', 'gmt_create')
      .andWhere('tag.vid=version.id')
      .andWhere(`tag.namespace='latest'`)
      .groupBy('id, name, description, version, size, versions, maintainers, likes')
      .orderBy({ 
        'pack.gmt_modified': 'DESC',
        'pack.gmt_create': 'DESC',
      })
      .limit(Number(top || '10'))
      .getRawMany();
  }

  @HTTPRouter({
    pathname: '/~/package/:pkg/state',
    methods: 'GET'
  })
  public async getNPMContext(@HTTPRequestParam('pkg') pkg: string) {
    const result = await axios.get('https://www.npmjs.com/package/' + pkg);
    const html = result.data as string;
    const matchs = /window\.__context__ = ([^<]+?)<\/script>/.exec(html);
    if (matchs) return JSON.parse(matchs[1]);
  }

  @HTTPRouter({
    pathname: '/~/package/:pkg/entity',
    methods: 'GET'
  })
  public async getPackageEntity(@HTTPRequestParam('pkg') pkg: string) {
    const Packages = this.connection.getRepository(PackageEntity);
    const pack = await Packages.findOne({ pathname: pkg });
    if (!pack) throw new HttpNotFoundException('找不到模块');
    const Maintainer = this.connection.getRepository(MaintainerEntity);
    const result = await Maintainer.createQueryBuilder('maintainer')
      .leftJoin(UserEntity, 'user', 'user.id=maintainer.uid')
      .select('user.id', 'uid')
      .addSelect('user.nickname', 'nickname')
      .where('maintainer.pid=:pid', { pid: pack.id })
      .getRawMany();
    
    return {
      uid: pack.uid,
      members: result,
    };
  }
}