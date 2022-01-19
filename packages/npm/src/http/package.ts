import * as ssri from 'ssri';
import { dirname, resolve } from 'path';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { TPackageVersionState } from './version';
import { TPackageMaintainerState } from './maintainer';
import { DependencyEntity, KeywordEntity, MaintainerEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';
import { ensureDirSync, writeFileSync, unlinkSync } from 'fs-extra';
import { Repository } from 'typeorm';
import { PackageEntity } from '@nppm/entity';
import { nanoid } from 'nanoid';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestBody, HTTPRequestState } from '@typeservice/http';
import { NPMCommander, NpmCommanderLimit, OnlyRunInCommanderLineInterface, UserInfoMiddleware, UserMustBeLoginedMiddleware } from '@nppm/utils';
import { HttpUnprocessableEntityException } from '@typeservice/exception';
import { HttpVersionService } from './version';
import { HttpDependencyService } from './dependency';
import { HttpKeywordService } from './keyword';
import { HttpMaintainerService } from './maintainer';
import { HttpTagService } from './tag';

const PACKAGE_ATTACH_DATA_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

@HTTPController()
export class HttpPackageService {
  @inject('npmcore') private readonly npmcore: NPMCore;
  @inject(HttpVersionService) private readonly HttpVersionService: HttpVersionService;
  @inject(HttpDependencyService) private readonly HttpDependencyService: HttpDependencyService;
  @inject(HttpKeywordService) private readonly HttpKeywordService: HttpKeywordService;
  @inject(HttpMaintainerService) private readonly HttpMaintainerService: HttpMaintainerService;
  @inject(HttpTagService) private readonly HttpTagService: HttpTagService;

  get connection() {
    return this.npmcore.orm.value;
  }

  @HTTPRouter({
    pathname: '/:pkg',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('publish'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  public main(
    @HTTPRequestBody() body: TPackagePublishState,
    @NPMCommander() commander: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    switch (commander) {
      case 'publish': return this.publish(body, user);
    }
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

    // 校验dist-tags
    if (!Object.keys(tags).length) throw new HttpUnprocessableEntityException('miss dist-tags');

    // 校验版本
    if (tags[Object.keys(tags)[0]] !== version.version) throw new HttpUnprocessableEntityException('versions different');
    
    // 校验scope是否允许发布
    if (!await this.checkScopeAllowed(scope, user)) throw new HttpUnprocessableEntityException('not allowed scope:' + scope);

    // 校验附件内容
    if (!attachment.data || typeof attachment.data !== 'string' || !PACKAGE_ATTACH_DATA_RE.test(attachment.data)) {
      throw new HttpUnprocessableEntityException('attachment content invalid');
    }

    // 包二进制流
    const tarballBuffer = Buffer.from(attachment.data, 'base64');
    if (tarballBuffer.length !== attachment.length) {
      throw new HttpUnprocessableEntityException(`size_wrong: Attachment size ${attachment.length} not match download size ${tarballBuffer.length}`);
    }

    // 校验附件合法性
    if (!this.checkHashAllowed(tarballBuffer, version.dist)) throw new HttpUnprocessableEntityException('attachment hash invalid');

    const rollbacks: (() => void | Promise<void>)[] = [];
    const runner = this.connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      // 创建活着获取包
      const Packages = runner.manager.getRepository(PackageEntity);
      const Version = runner.manager.getRepository(VersionEntity);
      const Dependency = runner.manager.getRepository(DependencyEntity);
      const Keyword = runner.manager.getRepository(KeywordEntity);
      const Maintainer = runner.manager.getRepository(MaintainerEntity);
      const Tag = runner.manager.getRepository(TagEntity);

      let pack = await Packages.findOne({ pathname: version.name });
      if (!pack) pack = await this.createNewPackage(version.name, user.id, Packages);

      // 校验用户权限
      const uids = new Set<number>();
      const maintainers = await this.HttpMaintainerService.getMaintainersByPackage(pack.id, Maintainer);
      uids.add(pack.uid);
      maintainers.forEach(maintainer => uids.add(maintainer.uid));

      if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admin');

      // 检测版本提交的合法性
      // 如果我们存在 ['1.5.3', '1.5.5', '1.6.4', '2.1.5']这些版本
      // 那么我们可以提交的版本有 ['1.5.6', '1.6.5', '1.7.0', '2.1.6', '2.0.9']等
      // 不能提交的版本有 ['1.5.4', '1.6.4', '2.1.5', '2.0.8'] 等
      if (!(await this.HttpVersionService.canVersionPublish(pack.id, version.version, Version))) {
        throw new HttpUnprocessableEntityException('invalid version');
      }

      // 插入新版本
      const _version = await this.HttpVersionService.createNewVersion(pack.id, filename, user.id, attachment, version, Version);

      // 插入所有依赖
      await this.HttpDependencyService.createNewVersionDependencies(_version.id, version.dependencies, Dependency);

      // 插入所有关键字
      await this.HttpKeywordService.createNewVersionKeywords(_version.id, version.keywords, Keyword);

      // 插入关联的maintainer信息
      await this.HttpMaintainerService.createNewMaintainer(pack.id, user.id, Maintainer);

      // 插入dist-tags集合
      const tag = Object.keys(tags)[0];
      await this.HttpTagService.createNewDistTag(pack.id, _version.id, tag, Tag);

      // 获取包的版本数量
      const versionCount = await this.HttpVersionService.getCountByPackage(pack.id, Version);
      // 获取包的maintainer数量
      const maintainerCount = await this.HttpMaintainerService.getCountByPackage(pack.id, Maintainer);

      // 更新包数据
      pack.versions = versionCount;
      pack.maintainers = maintainerCount;
      
      // 获取latest版本id
      const latestTagVerionId = await this.HttpTagService.getLatestVersion(pack.id, Tag);
      if (latestTagVerionId) {
        const v = await this.HttpVersionService.getVersionById(latestTagVerionId, Version);
        if (v) pack.rev = v.rev;
      }

      if (!pack.rev) pack.rev = _version.rev;

      pack = await Packages.save(pack);

      // 保存文件
      const file = await this.createDictionary(filename);
      writeFileSync(file, tarballBuffer);
      rollbacks.push(() => unlinkSync(file));
      await runner.commitTransaction();

      return {
        ok: true,
        rev: pack.rev,
      };
    } catch (e) {
      await runner.rollbackTransaction();
      let i = rollbacks.length;
      while (i--) await Promise.resolve(rollbacks[i]());
      throw e;
    } finally {
      await runner.release();
    }
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
    pack.rev = nanoid();
    pack.scope = scope;
    pack.uid = uid;
    pack.versions = 1;
    return repository.save(pack);
  }

  private updateNewPackage(pack: PackageEntity, repository?: Repository<PackageEntity>) {
    pack.gmt_modified = new Date();
    pack.maintainers = pack.maintainers + 1; // 需调整
    // pack.
  }
}

export interface TPackagePublishState {
  _id: string,
  name: string,
  description: string,
  'dist-tags': Record<string, string>,
  versions: Record<string, TPackageVersionState>,
  readme: string,
  access: string,
  maintainers: TPackageMaintainerState[],
  _attachments: Record<string, TPackageStreamState>,
  time?: {
    modified: string,
    created: string,
    [key: string]: string,
  },
  publish_time?: number,
}

export interface TPackageStreamState {
  content_type: string,
  data: string,
  length: number,
}