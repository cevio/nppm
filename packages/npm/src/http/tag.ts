import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { PackageCacheAble } from '@nppm/cache';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestParam, HTTPRequestState, HTTPRequestBody } from '@typeservice/http';
import { Repository } from 'typeorm';
import { MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';
import { HttpUnprocessableEntityException } from '@typeservice/exception';
import { createNPMErrorCatchMiddleware, NpmCommanderLimit, OnlyRunInCommanderLineInterface, UserInfoMiddleware, UserMustBeLoginedMiddleware } from '@nppm/utils';
import { HttpPackageFetchService } from './package.fetch';
import { HttpMaintainerService } from './maintainer';
import { HttpVersionService } from './version';
import { HttpTransactionService } from '../transaction';

@HTTPController()
export class HttpTagService {
  @inject('npmcore') private readonly npmcore: NPMCore;
  @inject(HttpTransactionService) private readonly HttpTransactionService: HttpTransactionService;
  @inject(HttpPackageFetchService) private readonly HttpPackageFetchService: HttpPackageFetchService;
  @inject(HttpMaintainerService) private readonly HttpMaintainerService: HttpMaintainerService;
  @inject(HttpVersionService) private readonly HttpVersionService: HttpVersionService;

  get connection() {
    return this.npmcore.orm.value;
  }

  @HTTPRouter({
    pathname: '/-/package/:pkg/dist-tags',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('dist-tag'))
  public async getDistTags(@HTTPRequestParam('pkg') pkg: string) {
    const res = await this.HttpPackageFetchService.readPackage(pkg);
    return res['dist-tags'];
  }

  @HTTPRouter({
    pathname: '/-/package/:pkg/dist-tags/:tag',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('dist-tag'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  public updateDistTag(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestParam('tag') tag: string,
    @HTTPRequestBody() code: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    return this.HttpTransactionService.transaction(async runner => {
      const uids = new Set<number>();
      const Packages = runner.manager.getRepository(PackageEntity);
      const Maintainer = runner.manager.getRepository(MaintainerEntity);
      const Version = runner.manager.getRepository(VersionEntity);
      const Tag = runner.manager.getRepository(TagEntity);
      const pack = await Packages.findOne({ pathname: pkg });
      if (!pack) throw new HttpUnprocessableEntityException('can not find package of ' + pkg);
      const maintainers = await this.HttpMaintainerService.getMaintainersByPackage(pack.id, Maintainer);
      uids.add(pack.uid);
      maintainers.forEach(maintainer => uids.add(maintainer.uid));
      if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admins');
      const version = await this.HttpVersionService.getVersionByCode(pack.id, code, Version);
      if (!version) throw new HttpUnprocessableEntityException('cannot find the version of ' + code);
      const vid = version.id;
      await this.createNewDistTag(pack.id, vid, tag, Tag);
      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
      return { ok: true }
    })
  }

  @HTTPRouter({
    pathname: '/-/package/:pkg/dist-tags/:tag',
    methods: 'DELETE'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('dist-tag'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  public async deleteDistTag(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestParam('tag') tag: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    return this.HttpTransactionService.transaction(async runner => {
      const uids = new Set<number>();
      const Packages = runner.manager.getRepository(PackageEntity);
      const Maintainer = runner.manager.getRepository(MaintainerEntity);
      const Tag = runner.manager.getRepository(TagEntity);
      const pack = await Packages.findOne({ pathname: pkg });
      if (!pack) throw new HttpUnprocessableEntityException('can not find package of ' + pkg);
      const maintainers = await this.HttpMaintainerService.getMaintainersByPackage(pack.id, Maintainer);
      uids.add(pack.uid);
      maintainers.forEach(maintainer => uids.add(maintainer.uid));
      if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admins');
      const vid = await this.getNameSpaceVersion(pack.id, tag, Tag);
      if (!vid) throw new HttpUnprocessableEntityException('cannot find the version of namespace:' + tag);
      await Tag.delete({ pid: pack.id, vid, namespace: tag });
      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
      return { ok: true }
    })
  }

  public async createNewDistTag(pid: number, vid: number, name: string, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    let tag = await Tag.findOne({ namespace: name, pid });
    if (!tag) {
      tag = new TagEntity();
      tag.gmt_create = new Date();
      tag.namespace = name || 'latest';
      tag.pid = pid;
    }
    tag.vid = vid;
    tag.gmt_modified = new Date();
    return await Tag.save(tag);
  }

  public getLatestVersion(pid: number, Tag?: Repository<TagEntity>) {
    return this.getNameSpaceVersion(pid, 'latest', Tag);
  }

  public async getNameSpaceVersion(pid: number, code: string, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    const tag = await Tag.findOne({ namespace: code, pid });
    if (tag) return tag.vid;
  }

  public async removeTagByVid(pid: number, vid: number, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    const tag = await Tag.findOne({ vid, pid });
    if (tag) {
      if (tag.namespace === 'latest') throw new HttpUnprocessableEntityException('cannot delete tag by name of latest');
      await Tag.delete(tag.id);
    }
  }

  public removeAll(pid: number, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    return Tag.delete({ pid });
  }
}