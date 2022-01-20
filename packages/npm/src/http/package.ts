import * as ssri from 'ssri';
import axios, { AxiosResponse } from 'axios';
import { dirname, resolve } from 'path';
import { resolve as urlResolve } from 'url';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { TPackageMaintainerState } from './maintainer';
import { DependencyEntity, KeywordEntity, MaintainerEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';
import { ensureDirSync, writeFileSync, unlinkSync, existsSync } from 'fs-extra';
import { Repository } from 'typeorm';
import { PackageEntity } from '@nppm/entity';
import { nanoid } from 'nanoid';
import { HttpUnprocessableEntityException, HttpNotFoundException, HttpException } from '@typeservice/exception';
import { HttpVersionService, TPackageVersionState } from './version';
import { HttpDependencyService } from './dependency';
import { HttpKeywordService } from './keyword';
import { HttpMaintainerService } from './maintainer';
import { HttpTagService } from './tag';
import { PackageCacheAble } from '@nppm/cache';
import { MD5 } from 'crypto-js';
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
  versionValid,
} from '@nppm/utils';

const PACKAGE_ATTACH_DATA_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const notFoundText = 'not found';

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

  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/:pkg',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('publish', 'deprecate'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  public updatePackage(
    @HTTPRequestBody() body: TPackagePublishState,
    @NPMCommander() commander: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    switch (commander) {
      case 'publish': return this.publish(body, user);
      case 'deprecate': return this.deprecate(body, user);
      default: throw new HttpNotFoundException();
    }
  }

  @HTTPRouter({
    pathname: '/:pkg',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  public async readPackage(@HTTPRequestParam('pkg') pkg: string) {
    const Packages = this.connection.getRepository(PackageEntity);
    const pack = await Packages.findOne({ pathname: pkg });
    const configs = await ConfigCacheAble.get(null, this.connection);
    if (pack && pack.is_private) {
      const result = await PackageCacheAble.get({ pkg }, this.connection);
      const versions = result.versions;
      for (const key in versions) {
        versions[key].dist.tarball = urlResolve(configs.domain, versions[key].dist.tarball);
      }
      return result;
    }
    
    const res = await configs.registries.reduce<Promise<AxiosResponse<any>>>((prev, registry) => {
      return prev.then((res) => {
        const state = res.data;
        if (state.error) return Promise.reject(new HttpNotFoundException(notFoundText));
        return res;
      }).catch((e: HttpException) => {
        if (e.status === 404) {
          return axios.get(urlResolve(registry, pkg)).catch(e => Promise.reject(new HttpNotFoundException(notFoundText)));
        }
        return Promise.reject(e);
      })
    }, Promise.reject(new HttpNotFoundException(notFoundText)));
    return res.data;
  }

  @HTTPRouter({
    pathname: '/:pkg/-rev/:key',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('unpublish'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  public async unpublishSinglePackage(
    @HTTPRequestBody() body: TPackagePublishState,
    @HTTPRequestState('user') user: UserEntity
  ) {
    const runner = this.connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
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
      console.log('delete version code', oldCodes, newCodes, removes)
      if (removes.length !== 1) throw new HttpUnprocessableEntityException('unpublish package version faild');

      const removeCode = removes[0];
      
      const version = await this.HttpVersionService.removeVersionByCode(pack.id, removeCode, Version);
      await this.HttpDependencyService.removeDenpenencyByVid(version.id, Dependency);
      await this.HttpKeywordService.removeKeywordByVid(version.id, Keyword);
      await this.HttpTagService.removeTagByVid(pack.id, version.id, Tag);
      const file = await this.removeFilename(version.tarball);

      await this.redis.set('npm:tarball:' + pack.rev + ':' + version.rev, file);

      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
      await runner.commitTransaction();
      return { 
        ok: true,
        _id: `${pack.pathname}@${removeCode}`,
        name: `${pack.pathname}@${removeCode}`,
        _rev: pack.rev,
      };
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  @HTTPRouter({
    pathname: '/~/download/:rev.tgz/-rev/:key',
    methods: 'DELETE'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('unpublish'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
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
      if (existsSync(file)) {
        unlinkSync(file);
      }
      await this.redis.del(tarballkey);
    }

    return { ok: true };
  }

  @HTTPRouter({
    pathname: '/:pkg/-rev/:key',
    methods: 'DELETE'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('unpublish'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  public async unpublishAll(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestParam('key') key: string,
    @HTTPRequestState('user') user: UserEntity
  ) {
    const runner = this.connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
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

      await runner.commitTransaction();
      return { ok: true };
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  private async deprecate(body: TPackagePublishState, user: UserEntity) {
    const runner = this.connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
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

      for (const key in body.versions) {
        if (body.versions[key].deprecated) {
          // @ts-ignore
          const rev = body.versions[key].rev || body.versions[key]._rev;
          const msg = body.versions[key].deprecated;
          await this.HttpVersionService.updateDeprecated(rev, msg, Version);
        }
      }

      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
      await runner.commitTransaction();
      return { ok: true };
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
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

    // 检查版本合法
    if (!versionValid(version.version)) throw new HttpUnprocessableEntityException('versions invalid');

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

      if (!uids.has(user.id)) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admins');

      // 检测版本提交的合法性
      // 如果我们存在 ['1.5.3', '1.5.5', '1.6.4', '2.1.5']这些版本
      // 那么我们可以提交的版本有 ['1.5.6', '1.6.5', '1.7.0', '2.1.6', '2.0.9']等
      // 不能提交的版本有 ['1.5.4', '1.6.4', '2.1.5', '2.0.8'] 等
      const allowed = await this.HttpVersionService.canVersionPublish(pack.id, version.version, Version);
      if (!allowed[0]) {
        throw new HttpUnprocessableEntityException('You cannot publish over the previously published version ' + allowed[1]);
      }

      // 校验latest dist-tags
      const _vid = await this.HttpTagService.getLatestVersion(pack.id, Tag);
      if (!_vid && Object.keys(tags)[0] !== 'latest') {
        throw new HttpUnprocessableEntityException('You must publish this version with latest tag');
      }

      // 插入新版本
      const _version = await this.HttpVersionService.createNewVersion(pack.id, filename, user.id, attachment, version, Version);
      // 插入所有依赖
      await this.HttpDependencyService.createNewVersionDependencies(_version.id, pack.id, version.dependencies, Dependency);
      // 插入所有关键字
      await this.HttpKeywordService.createNewVersionKeywords(_version.id, pack.id, version.keywords, Keyword);
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
      pack.gmt_modified = new Date();
      pack = await Packages.save(pack);

      // 保存文件
      const file = await this.createDictionary(filename);
      writeFileSync(file, tarballBuffer);
      rollbacks.push(() => unlinkSync(file));
      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
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

  private async removeFilename(filename: string) {
    const HOME = this.npmcore.HOME;
    const configs = await ConfigCacheAble.get(null, this.connection);
    const file = resolve(HOME, configs.dictionary || 'packages', filename);
    if (existsSync(file)) unlinkSync(file);
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
    return repository.save(pack);
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

export function diff(a: string[], b: string[]) {
  const removes = [];
  const commons = [];
  
  a = a.slice().sort();
  b = b.slice().sort();
  
  for (let i = 0; i < a.length; i++) {
    const value = a[i];
    const index = b.indexOf(value);
    if (index === -1) {
      removes.push(value);
    } else {
      commons.push(value);
      b.splice(index, 1);
    }
  }
  return {
    removes, commons,
    adds: b
  }
}
