import * as ssri from 'ssri';
import { dirname, resolve } from 'path';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { DependencyEntity, KeywordEntity, MaintainerEntity, TagEntity, UserEntity, VersionEntity, StarEntity } from '@nppm/entity';
import { ensureDirSync, writeFileSync, unlinkSync } from 'fs-extra';
import { Repository } from 'typeorm';
import { PackageEntity } from '@nppm/entity';
import { nanoid } from 'nanoid';
import { HttpUnprocessableEntityException, HttpNotFoundException } from '@typeservice/exception';
import { HttpVersionService, TPackageVersionState } from './version';
import { HttpDependencyService } from './dependency';
import { HttpKeywordService } from './keyword';
import { HttpMaintainerService } from './maintainer';
import { HttpTagService } from './tag';
import { PackageCacheAble } from '@nppm/cache';
import { MD5 } from 'crypto-js';
import { HttpTransactionService } from '../transaction';
import type { TPackagePublishState, TPackageStarState } from './package.interface';
import { 
  HTTPController, 
  HTTPRouter, 
  HTTPRouterMiddleware, 
  HTTPRequestBody, 
  HTTPRequestState, 
} from '@typeservice/http';
import { 
  createNPMErrorCatchMiddleware, 
  NPMCommander, 
  NpmCommanderLimit, 
  OnlyRunInCommanderLineInterface, 
  UserInfoMiddleware, 
  UserMustBeLoginedMiddleware, 
  UserNotForbiddenMiddleware, 
  versionValid,
} from '@nppm/utils';

const PACKAGE_ATTACH_DATA_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

@HTTPController()
export class HttpPackagePublishService {
  @inject('npmcore') private readonly npmcore: NPMCore;
  @inject(HttpTransactionService) private readonly HttpTransactionService: HttpTransactionService;
  @inject(HttpVersionService) private readonly HttpVersionService: HttpVersionService;
  @inject(HttpDependencyService) private readonly HttpDependencyService: HttpDependencyService;
  @inject(HttpKeywordService) private readonly HttpKeywordService: HttpKeywordService;
  @inject(HttpMaintainerService) private readonly HttpMaintainerService: HttpMaintainerService;
  @inject(HttpTagService) private readonly HttpTagService: HttpTagService;

  get connection() {
    return this.npmcore.orm.value;
  }

  /**
   * ??????????????????????????????
   * - npm publish
   * - npm deprecate [message]
   * @param body 
   * @param commander 
   * @param user 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/:pkg',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('publish', 'deprecate', 'star', 'unstar'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public updatePackage(
    @HTTPRequestBody() body: TPackagePublishState | TPackageStarState,
    @NPMCommander() commander: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    switch (commander) {
      case 'publish': return this.publish(body as TPackagePublishState, user);
      case 'deprecate': return this.deprecate(body as TPackagePublishState, user);
      case 'star': return this.star(body as TPackageStarState, user);
      case 'unstar': return this.unstar(body as TPackageStarState, user);
      default: throw new HttpNotFoundException();
    }
  }

  public async star(body: { _id: string }, user: UserEntity) {
    const Packages = this.connection.getRepository(PackageEntity);
    let pack = await Packages.findOne({ pathname: body._id });
    if (!pack) throw new HttpUnprocessableEntityException('can not find package of ' + body._id);
    const Star = this.connection.getRepository(StarEntity);
    const num = await Star.count({ uid: user.id, pid: pack.id });
    if (!num) {
      await Star.insert({ 
        uid: user.id, 
        pid: pack.id, 
        gmt_create: new Date(), 
        gmt_modified: new Date() 
      });
      pack.likes = 1;
    } else {
      pack.likes++;
    }
    await Packages.save(pack);
    this.npmcore.emit('star', pack);
    return {
      ok: true
    }
  }

  public async unstar(body: { _id: string }, user: UserEntity) {
    const Packages = this.connection.getRepository(PackageEntity);
    let pack = await Packages.findOne({ pathname: body._id });
    if (!pack) throw new HttpUnprocessableEntityException('can not find package of ' + body._id);
    const Star = this.connection.getRepository(StarEntity);
    const star = await Star.findOne({ uid: user.id, pid: pack.id });
    if (star) {
      await Star.delete(star.id);
      pack.likes--;
      await Packages.save(pack);
      this.npmcore.emit('unstar', pack);
    }
    return {
      ok: true
    }
  }

  private deprecate(body: TPackagePublishState, user: UserEntity) {
    return this.HttpTransactionService.transaction(async runner => {
      const uids = new Set<number>();
      const Packages = runner.manager.getRepository(PackageEntity);
      const Maintainer = runner.manager.getRepository(MaintainerEntity);
      const Version = runner.manager.getRepository(VersionEntity);
      let pack = await Packages.findOne({ pathname: body.name });
      if (!pack) throw new HttpUnprocessableEntityException('can not find package of ' + body.name);
      const maintainers = await this.HttpMaintainerService.getMaintainersByPackage(pack.id, Maintainer);
      uids.add(pack.uid);
      maintainers.forEach(maintainer => uids.add(maintainer.uid));
      if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admins');

      const deprecates: VersionEntity[] = [];
      for (const key in body.versions) {
        if (body.versions[key].deprecated) {
          // @ts-ignore
          const rev = body.versions[key].rev || body.versions[key]._rev;
          const msg = body.versions[key].deprecated;
          deprecates.push(await this.HttpVersionService.updateDeprecated(rev, msg, Version));
        }
      }

      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
      this.npmcore.emit('deprecate', pack, ...deprecates);
      return { ok: true };
    })
  }

  private async publish(body: TPackagePublishState, user: UserEntity) {
    const versionKeys = Object.keys(body.versions);
    const attachmentKeys = Object.keys(body._attachments);

    if (!versionKeys.length) throw new HttpUnprocessableEntityException('miss version');
    if (!attachmentKeys.length) throw new HttpUnprocessableEntityException('miss attachment');

    const version = body.versions[versionKeys[0]];
    const filename = attachmentKeys[0];
    const attachment = body._attachments[filename];
    const tags = body['dist-tags'];
    const scope = version.name.split('/')[0];

    // ??????dist-tags
    if (!Object.keys(tags).length) throw new HttpUnprocessableEntityException('miss dist-tags');

    // ??????????????????
    if (!versionValid(version.version)) throw new HttpUnprocessableEntityException('versions invalid');

    // ????????????
    if (tags[Object.keys(tags)[0]] !== version.version) throw new HttpUnprocessableEntityException('versions different');
    
    // ??????scope??????????????????
    if (!await this.checkScopeAllowed(scope, user)) throw new HttpUnprocessableEntityException('not allowed scope:' + scope);

    // ??????????????????
    if (!attachment.data || typeof attachment.data !== 'string' || !PACKAGE_ATTACH_DATA_RE.test(attachment.data)) {
      throw new HttpUnprocessableEntityException('attachment content invalid');
    }

    // ???????????????
    const tarballBuffer = Buffer.from(attachment.data, 'base64');
    if (tarballBuffer.length !== attachment.length) {
      throw new HttpUnprocessableEntityException(`size_wrong: Attachment size ${attachment.length} not match download size ${tarballBuffer.length}`);
    }

    // ?????????????????????
    if (!this.checkHashAllowed(tarballBuffer, version.dist)) throw new HttpUnprocessableEntityException('attachment hash invalid');

    return await this.HttpTransactionService.transaction(async (runner, rollbacks) => {
      // ?????????????????????
      const Packages = runner.manager.getRepository(PackageEntity);
      const Version = runner.manager.getRepository(VersionEntity);
      const Dependency = runner.manager.getRepository(DependencyEntity);
      const Keyword = runner.manager.getRepository(KeywordEntity);
      const Maintainer = runner.manager.getRepository(MaintainerEntity);
      const Tag = runner.manager.getRepository(TagEntity);

      let pack = await Packages.findOne({ pathname: version.name });
      if (!pack) pack = await this.createNewPackage(version.name, user.id, Packages);

      // ??????????????????
      const uids = new Set<number>();
      const maintainers = await this.HttpMaintainerService.getMaintainersByPackage(pack.id, Maintainer);
      uids.add(pack.uid);
      maintainers.forEach(maintainer => uids.add(maintainer.uid));

      if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admins');

      // ??????????????????????????????
      // ?????????????????? ['1.5.3', '1.5.5', '1.6.4', '2.1.5']????????????
      // ???????????????????????????????????? ['1.5.6', '1.6.5', '1.7.0', '2.1.6', '2.0.9']???
      // ???????????????????????? ['1.5.4', '1.6.4', '2.1.5', '2.0.8'] ???
      const allowed = await this.HttpVersionService.canVersionPublish(pack.id, version.version, Version);
      if (!allowed[0]) {
        throw new HttpUnprocessableEntityException('You cannot publish over the previously published version ' + allowed[1]);
      }

      // ??????latest dist-tags
      const _vid = await this.HttpTagService.getLatestVersion(pack.id, Tag);
      if (!_vid && Object.keys(tags)[0] !== 'latest') {
        throw new HttpUnprocessableEntityException('You must publish this version with latest tag');
      }

      // ???????????????
      const _version = await this.HttpVersionService.createNewVersion(pack.id, filename, user.id, attachment, version, Version);
      // ??????????????????
      await this.HttpDependencyService.createNewVersionDependencies(_version.id, pack.id, version.dependencies, Dependency);
      // ?????????????????????
      await this.HttpKeywordService.createNewVersionKeywords(_version.id, pack.id, version.keywords, Keyword);
      // ???????????????maintainer??????
      await this.HttpMaintainerService.createNewMaintainer(pack.id, user.id, Maintainer);
      // ??????dist-tags??????
      const tag = Object.keys(tags)[0];
      await this.HttpTagService.createNewDistTag(pack.id, _version.id, tag, Tag);
      // ????????????????????????
      const versionCount = await this.HttpVersionService.getCountByPackage(pack.id, Version);
      // ????????????maintainer??????
      const maintainerCount = await this.HttpMaintainerService.getCountByPackage(pack.id, Maintainer);
      // ???????????????
      pack.versions = versionCount;
      pack.maintainers = maintainerCount;
      pack.gmt_modified = new Date();
      pack = await Packages.save(pack);

      // ????????????
      const file = await this.createDictionary(filename);
      writeFileSync(file, tarballBuffer);
      rollbacks.push(() => unlinkSync(file));
      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
      this.npmcore.emit('publish', pack);
      return {
        ok: true,
        rev: pack.rev,
      };
    });
  }

  private async checkScopeAllowed(scope: string, user: UserEntity) {
    const configs = await ConfigCacheAble.get(null, this.connection);
    const allowedInConfigs = configs.scopes.includes(scope);
    const allowedInUserScopes = user.scopes.includes(scope);
    return allowedInConfigs || allowedInUserScopes;
  }

  private async createDictionary(filename: string) {
    const HOME = this.npmcore.HOME;
    const configs = await ConfigCacheAble.get(null, this.connection);
    const file = resolve(HOME, configs.dictionary || 'packages', filename);
    const dir = dirname(file);
    ensureDirSync(dir);
    return file;
  }

  private checkHashAllowed(tarballBytes: Buffer, dist: TPackageVersionState['dist']) {
    const integrity = dist?.integrity;
    if (integrity) {
      const algorithm = ssri.checkData(tarballBytes, integrity);
      if (!algorithm) return false;
    } else {
      const integrityObj = ssri.fromData(tarballBytes, { algorithms: [ 'sha1' ] });
      // @ts-ignore
      const shasum: string = integrityObj.sha1[0].hexDigest();
      if (dist?.shasum && dist.shasum !== shasum) return false;
    }
    return true;
  }

  private createNewPackage(namespace: string, uid: number, repository?: Repository<PackageEntity>) {
    const splitName = namespace.split('/');
    const scope = splitName[0];
    const name = splitName[1];
    repository = repository || this.connection.getRepository(PackageEntity);
    const pack = new PackageEntity();
    pack.gmt_create = new Date();
    pack.gmt_modified = new Date();
    pack.is_private = true;
    pack.maintainers = 1;
    pack.name = name;
    pack.pathname = namespace;
    pack.rev = MD5(nanoid()).toString();
    pack.scope = scope;
    pack.uid = uid;
    pack.versions = 1;
    pack.likes = 0;
    return repository.save(pack);
  }
}