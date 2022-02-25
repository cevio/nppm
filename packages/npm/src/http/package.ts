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
          .where('maintainer.uid=:uid', { uid: _uid })
          .andWhere('tag.vid=version.id')
          .andWhere(`tag.namespace='latest'`)
          .distinct(true);

    if (keyword) {
      builder = builder.andWhere('pack.pathname LIKE :keyword', { keyword: '%' + keyword + '%' });
    }

    builder = builder.groupBy('1,2,3,4,5');

    const count = await builder.clone().getCount();

    builder = builder.orderBy({ 'pack.gmt_modified': 'DESC' }).offset((_page - 1) * _size).limit(_size);

    builder = builder.orderBy({ 'pack.gmt_modified': 'DESC' }).offset((_page - 1) * _size).limit(_size);
    return [
      (await builder.getRawMany()) as TPackage[],
      count,
    ] as const;

    // const Packages = this.connection.getRepository(PackageEntity);
    // const Tag = this.connection.getRepository(TagEntity);
    // const builder = Packages.createQueryBuilder('pack')
    //   .leftJoin(VersionEntity, 'version', 'version.pid=pack.id')
    //   .leftJoin(DowloadEntity, 'download', 'download.vid=version.id')
    //   .select('pack.pathname', 'name')
    //   .addSelect('pack.id', 'id')
    //   .addSelect('version.description', 'description')
    //   .addSelect('pack.uid', 'auid')
    //   .addSelect('COUNT(download.id)', 'downloads')
    //   .where('version.uid=:uid', { uid: user.id })
    //   .groupBy('1,2,3,4')
    //   .distinct(true);
    
    // if (keyword) builder.andWhere('pack.pathname LIKE :keyword', { keyword: '%' + keyword + '%' });
    // const count = await builder.clone().getCount();
    // builder.offset((_page - 1) * _size).limit(_size);
    // const packages: TPackage[] = await builder.getRawMany();

    // const pids = packages.map(pack => pack.id);

    // type TResult = {
    //   id: number,
    //   code: string,
    //   size: number,
    //   uid: number,
    // }
    
    // const result: TResult[] = !packages.length ? [] : await Tag.createQueryBuilder('tag')
    //   .leftJoin(VersionEntity, 'version', 'version.id=tag.vid')
    //   .select('version.code', 'code')
    //   .addSelect('tag.pid', 'id')
    //   .addSelect('version.attachment_size', 'size')
    //   .addSelect('version.uid', 'uid')
    //   .where('tag.pid IN (:pids) AND tag.namespace=:namespace', { pids, namespace: 'latest' })
    //   .getRawMany();
    // const versions = new Map<number, { code: string, size: number, uid: number }>();
    // result.forEach(res => versions.set(res.id, {
    //   code: res.code,
    //   size: res.size,
    //   uid: res.uid
    // }));
    // return [packages.map(pack => {
    //   pack.version = versions.get(pack.id).code;
    //   pack.size = versions.get(pack.id).size;
    //   pack.uid = versions.get(pack.id).uid;
    //   pack.downloads = Number(pack.downloads);
    //   return pack;
    // }), count] as const;
  }

  /**
   * 转让管理员
   * @param id 
   * @param user 
   * @param body 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/packages/:id(\\d+)/transfer',
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
    const pid = Number(id);
    const Packages = this.connection.getRepository(PackageEntity);
    const pack = await Packages.findOne(pid);
    if (!pack) throw new HttpNotFoundException('cannot find the package id of ' + pid);
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
    return Packages.createQueryBuilder('p')
      .leftJoin(UserEntity, 'u', 'u.id=p.uid')
      .select('p.id', 'id')
      .addSelect('p.pathname', 'pathname')
      .addSelect('u.nickname', 'nickname')
      .addSelect('u.avatar', 'avatar')
      .addSelect('p.versions', 'versions')
      .addSelect('p.maintainers', 'maintainers')
      .addSelect('p.gmt_modified', 'gmt_modified')
      .orderBy({ 
        'p.gmt_modified': 'DESC',
        'p.gmt_create': 'DESC',
      })
      .limit(Number(top || '10'))
      .getRawMany();
  }

  @HTTPRouter({
    pathname: '/~/package/:pkg/npmjs',
    methods: 'GET'
  })
  public async getNPMContext(@HTTPRequestParam('pkg') pkg: string) {
    const result = await axios.get('https://www.npmjs.com/package/' + pkg);
    const html = result.data as string;
    const matchs = /window\.__context__ = ([^<]+?)<\/script>/.exec(html);
    if (matchs) return JSON.parse(matchs[1]);
  }
}