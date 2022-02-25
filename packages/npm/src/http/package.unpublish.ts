import { resolve } from 'path';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { DependencyEntity, KeywordEntity, MaintainerEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';
import { unlinkSync, existsSync } from 'fs-extra';
import { PackageEntity } from '@nppm/entity';
import { HttpUnprocessableEntityException } from '@typeservice/exception';
import { HttpVersionService } from './version';
import { HttpDependencyService } from './dependency';
import { HttpKeywordService } from './keyword';
import { HttpMaintainerService } from './maintainer';
import { HttpTagService } from './tag';
import { PackageCacheAble } from '@nppm/cache';
import { HttpTransactionService } from '../transaction';
import type { TPackagePublishState } from './package.interface';
import type { TOwnerState } from './owner';
import { diff } from '../diff';
import { HttpOwnerService } from './owner';
import { 
  HTTPController, 
  HTTPRouter, 
  HTTPRouterMiddleware, 
  HTTPRequestBody, 
  HTTPRequestState, 
  HTTPRequestParam 
} from '@typeservice/http';
import { 
  createNPMErrorCatchMiddleware, 
  NPMCommander, 
  NpmCommanderLimit, 
  OnlyRunInCommanderLineInterface, 
  UserInfoMiddleware, 
  UserMustBeLoginedMiddleware,
  UserNotForbiddenMiddleware, 
} from '@nppm/utils';

@HTTPController()
export class HttpPackageUnPublishService {
  @inject('npmcore') private readonly npmcore: NPMCore;
  @inject(HttpTransactionService) private readonly HttpTransactionService: HttpTransactionService;
  @inject(HttpVersionService) private readonly HttpVersionService: HttpVersionService;
  @inject(HttpDependencyService) private readonly HttpDependencyService: HttpDependencyService;
  @inject(HttpKeywordService) private readonly HttpKeywordService: HttpKeywordService;
  @inject(HttpMaintainerService) private readonly HttpMaintainerService: HttpMaintainerService;
  @inject(HttpTagService) private readonly HttpTagService: HttpTagService;
  @inject(HttpOwnerService) private readonly HttpOwnerService: HttpOwnerService;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  /**
   * 删除单个包
   * - npm unpublish
   * - npm unpublish <@module@version>
   * @param body 
   * @param user 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/:pkg/-rev/:key',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('unpublish', 'owner'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public unpublishSinglePackage(
    @HTTPRequestBody() body: TPackagePublishState | TOwnerState,
    @NPMCommander() commander: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    if (commander === 'owner') return this.HttpOwnerService.updateOwner(body as TOwnerState, user);
    return this.HttpTransactionService.transaction(async runner => {
      body = body as TPackagePublishState;
      const uids = new Set<number>();
      const Packages = runner.manager.getRepository(PackageEntity);
      const Maintainer = runner.manager.getRepository(MaintainerEntity);
      const Version = runner.manager.getRepository(VersionEntity);
      const Dependency = runner.manager.getRepository(DependencyEntity);
      const Keyword = runner.manager.getRepository(KeywordEntity);
      const Tag = runner.manager.getRepository(TagEntity);
      let pack = await Packages.findOne({ pathname: body.name });
      if (!pack) throw new HttpUnprocessableEntityException('can not find package of ' + body.name);
      const maintainers = await this.HttpMaintainerService.getMaintainersByPackage(pack.id, Maintainer);
      uids.add(pack.uid);
      maintainers.forEach(maintainer => uids.add(maintainer.uid));
      if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admins');

      const versions = await this.HttpVersionService.getVersionsByPid(pack.id, Version);
      const oldCodes = versions.map(version => version.code);
      const newCodes = Object.keys(body.versions)
      const { removes } = diff(oldCodes, newCodes);
      if (removes.length !== 1) throw new HttpUnprocessableEntityException('unpublish package version faild');

      const removeCode = removes[0];
      const version = await this.HttpVersionService.removeVersionByCode(pack.id, removeCode, Version);
      await this.HttpDependencyService.removeDenpenencyByVid(version.id, Dependency);
      await this.HttpKeywordService.removeKeywordByVid(version.id, Keyword);
      await this.HttpTagService.removeTagByVid(pack.id, version.id, Tag);
      
      // 获取包的版本数量
      const versionCount = await this.HttpVersionService.getCountByPackage(pack.id, Version);
      // 获取包的maintainer数量
      const maintainerCount = await this.HttpMaintainerService.getCountByPackage(pack.id, Maintainer);
      // 更新包数据
      pack.versions = versionCount;
      pack.maintainers = maintainerCount;
      pack.gmt_modified = new Date();
      await Packages.save(pack);

      const file = await this.removeFilename(version.tarball);
      await this.redis.set('npm:tarball:' + pack.rev + ':' + version.rev, file);
      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
      this.npmcore.emit('unpublish', pack, version);
      return { 
        ok: true,
        _id: `${pack.pathname}@${removeCode}`,
        name: `${pack.pathname}@${removeCode}`,
        _rev: pack.rev,
      };
    })
  }

  /**
   * 删除模块物理文件
   * - npm unpublish
   * - npm unpublish <@module@version>
   * @param rev 
   * @param key 
   * @param user 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/download/:rev.tgz/-rev/:key',
    methods: 'DELETE'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('unpublish'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async removeTGZ(
    @HTTPRequestParam('rev') rev: string,
    @HTTPRequestParam('key') key: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    const uids = new Set<number>();
    const Packages = this.connection.getRepository(PackageEntity);
    const Maintainer = this.connection.getRepository(MaintainerEntity);
    let pack = await Packages.findOne({ rev: key });
    if (!pack) throw new HttpUnprocessableEntityException('can not find package rev of ' + key);
    const maintainers = await this.HttpMaintainerService.getMaintainersByPackage(pack.id, Maintainer);
    uids.add(pack.uid);
    maintainers.forEach(maintainer => uids.add(maintainer.uid));
    if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admins');

    const tarballkey = 'npm:tarball:' + key + ':' + rev;
    if (await this.redis.exists(tarballkey)) {
      const file = await this.redis.get(tarballkey);
      if (existsSync(file)) unlinkSync(file);
      await this.redis.del(tarballkey);
    }

    return { ok: true };
  }

  /**
   * 删除整个模块
   * - npm unpublish [@pkg]
   * @param pkg 
   * @param key 
   * @param user 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/:pkg/-rev/:key',
    methods: 'DELETE'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('unpublish'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public unpublishAll(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestParam('key') key: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    return this.HttpTransactionService.transaction(async runner => {
      const uids = new Set<number>();
      const Packages = runner.manager.getRepository(PackageEntity);
      const Maintainer = runner.manager.getRepository(MaintainerEntity);
      const Version = runner.manager.getRepository(VersionEntity);
      const Dependency = runner.manager.getRepository(DependencyEntity);
      const Keyword = runner.manager.getRepository(KeywordEntity);
      const Tag = runner.manager.getRepository(TagEntity);
      let pack = await Packages.findOne({ rev: key });
      if (!pack) throw new HttpUnprocessableEntityException('can not find package rev of ' + key);
      if (pack.pathname !== pkg) throw new HttpUnprocessableEntityException('unaccept package name');
      uids.add(pack.uid);
      if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of package admins');

      const versions = await this.HttpVersionService.getVersionsByPid(pack.id, Version);

      await this.HttpDependencyService.removeAll(pack.id, Dependency);
      await this.HttpKeywordService.removeAll(pack.id, Keyword);
      await this.HttpMaintainerService.removeAll(pack.id, Maintainer);
      await this.HttpTagService.removeAll(pack.id, Tag);
      await this.HttpVersionService.removeAll(pack.id, Version);
      await Packages.delete(pack.id);
      await PackageCacheAble.del({ pkg: pack.pathname });
      
      for (let i = 0; i < versions.length; i++) {
        const version = versions[i];
        await this.removeFilename(version.tarball);
      }

      this.npmcore.emit('unpublish', pack);

      return { ok: true };
    })
  }

  private async removeFilename(filename: string) {
    const HOME = this.npmcore.HOME;
    const configs = await ConfigCacheAble.get(null, this.connection);
    const file = resolve(HOME, configs.dictionary || 'packages', filename);
    if (existsSync(file)) unlinkSync(file);
    return file;
  }
}