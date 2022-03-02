import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HttpPackagePublishService } from './package.publish';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestState, HTTPRequestParam, HTTPRequestBody, HTTPRequestQuery } from '@typeservice/http';
import { HttpNotFoundException, HttpNotAcceptableException } from '@typeservice/exception';
import { DowloadEntity, PackageEntity, StarEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';
import { 
  createNPMErrorCatchMiddleware, 
  NpmCommanderLimit, 
  OnlyRunInCommanderLineInterface, 
  UserInfoMiddleware, 
  UserMustBeLoginedMiddleware, 
  UserNotForbiddenMiddleware 
} from '@nppm/utils';

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

@HTTPController()
export class HttpStarService {
  @inject('npmcore') private readonly npmcore: NPMCore;
  @inject(HttpPackagePublishService) private readonly HttpPackagePublishService: HttpPackagePublishService;

  get connection() {
    return this.npmcore.orm.value;
  }

  @HTTPRouter({
    pathname: '/-/_view/starredByUser',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('stars'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async getStars(@HTTPRequestState('user') user: UserEntity) {
    const Star = this.connection.getRepository(StarEntity);
    const rows = await Star.createQueryBuilder('star')
      .leftJoin(PackageEntity, 'pack', 'pack.id=star.pid')
      .select('pack.pathname', 'value')
      .where({ uid: user.id })
      .getRawMany();

    return { rows }
  }

  @HTTPRouter({
    pathname: '/~/star/:pkg',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public star(
    @HTTPRequestParam('pkg') pkg: string, 
    @HTTPRequestBody() body: { status: boolean },
    @HTTPRequestState('user') user: UserEntity
  ) {
    return body.status 
      ? this.HttpPackagePublishService.star({ _id: pkg }, user)
      : this.HttpPackagePublishService.unstar({ _id: pkg }, user);
  }

  @HTTPRouter({
    pathname: '/~/star/:pkg',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async getStarStatusByPackage(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestState('user') user: UserEntity,
  ) {
    const Packages = this.connection.getRepository(PackageEntity);
    const pack = await Packages.findOne({ pathname: pkg });
    if (!pack) throw new HttpNotFoundException('找不到模块');
    const Star = this.connection.getRepository(StarEntity);
    const count = await Star.count({ pid: pack.id, uid: user.id });
    return {
      status: !!count,
      count: pack.likes,
    }
  }

  @HTTPRouter({
    pathname: '/~/stars',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async getMyStars(
    @HTTPRequestQuery('page') page: string,
    @HTTPRequestQuery('size') size: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    const _page = Number(page);
    const _size = Number(size);
    if (!_page || _page <= 0) throw new HttpNotAcceptableException('page invalid');
    if (!_size || _size <= 0) throw new HttpNotAcceptableException('size invalid');
    const Star = this.connection.getRepository(StarEntity);
    let builder = Star.createQueryBuilder('star')
      .leftJoin(PackageEntity, 'pack', 'pack.id=star.pid')
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
      .where('star.uid=:uid', { uid: user.id })
      .andWhere('tag.vid=version.id')
      .andWhere(`tag.namespace='latest'`);
    builder = builder.groupBy('id, name, description, version, size, versions, maintainers, likes');
    const count = await builder.clone().getCount();
    builder = builder.orderBy({ 'pack.likes': 'DESC', 'pack.gmt_modified': 'DESC' }).offset((_page - 1) * _size).limit(_size);
    return [
      (await builder.getRawMany()) as TPackage[],
      count,
    ] as const;
  }

  @HTTPRouter({
    pathname: '/~/stars/rank',
    methods: 'GET'
  })
  public async starsRank(
    @HTTPRequestQuery('page') page: string = '1',
    @HTTPRequestQuery('size') size: string = '15',
  ) {
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
      .where('pack.likes>0')
      .andWhere('tag.vid=version.id')
      .andWhere(`tag.namespace='latest'`)
    builder = builder.groupBy('id, name, description, version, size, versions, maintainers, likes');
    const count = await builder.clone().getCount();
    builder = builder.orderBy({ 'pack.likes': 'DESC', 'pack.gmt_modified': 'DESC' }).offset((_page - 1) * _size).limit(_size);
    return [
      (await builder.getRawMany()) as TPackage[],
      count,
    ] as const;
  }
}