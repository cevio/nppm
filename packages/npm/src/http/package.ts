import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { PackageCacheAble } from '@nppm/cache';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestState, HTTPRequestQuery, HTTPRequestBody, HTTPRequestParam } from '@typeservice/http';
import { UserInfoMiddleware, UserMustBeLoginedMiddleware, UserNotForbiddenMiddleware } from '@nppm/utils';
import { PackageEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';
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
    pathname: '/~/packages',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async myPackages(
    @HTTPRequestState('user') user: UserEntity,
    @HTTPRequestQuery('page') page: string,
    @HTTPRequestQuery('size') size: string,
    @HTTPRequestQuery('keyword') keyword: string
  ) {
    const _page = Number(page);
    const _size = Number(size);
    if (!_page || _page <= 0) throw new HttpNotAcceptableException('page invalid');
    if (!_size || _size <= 0) throw new HttpNotAcceptableException('size invalid');

    type TPackage = {
      name: string,
      id: number,
      description: string,
      version: string,
      size: number,
      auid: number,
      uid: number,
    }

    const Packages = this.connection.getRepository(PackageEntity);
    const Tag = this.connection.getRepository(TagEntity);
    const builder = Packages.createQueryBuilder('pack')
      .leftJoin(VersionEntity, 'version', 'version.pid=pack.id')
      .select('pack.pathname', 'name')
      .addSelect('pack.id', 'id')
      .addSelect('version.description', 'description')
      .addSelect('pack.uid', 'auid')
      .where('version.uid=:uid', { uid: user.id })
      .distinct(true);
    
    if (keyword) builder.andWhere('pack.pathname LIKE :keyword', { keyword: '%' + keyword + '%' });
    const count = await builder.clone().getCount();
    builder.offset((_page - 1) * _size).limit(_size);
    const packages: TPackage[] = await builder.getRawMany();

    const pids = packages.map(pack => pack.id);

    type TResult = {
      id: number,
      code: string,
      size: number,
      uid: number,
    }
    
    const result: TResult[] = !packages.length ? [] : await Tag.createQueryBuilder('tag')
      .leftJoin(VersionEntity, 'version', 'version.id=tag.vid')
      .select('version.code', 'code')
      .addSelect('tag.pid', 'id')
      .addSelect('version.attachment_size', 'size')
      .addSelect('version.uid', 'uid')
      .where('tag.pid IN (:pids) AND tag.namespace=:namespace', { pids, namespace: 'latest' })
      .getRawMany();
    const versions = new Map<number, { code: string, size: number, uid: number }>();
    result.forEach(res => versions.set(res.id, {
      code: res.code,
      size: res.size,
      uid: res.uid
    }));
    return [packages.map(pack => {
      pack.version = versions.get(pack.id).code;
      pack.size = versions.get(pack.id).size;
      pack.uid = versions.get(pack.id).uid;
      return pack;
    }), count] as const;
  }

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
    return await PackageCacheAble.build({ pkg: pack.pathname }, this.connection);
  }
}