import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { Repository } from 'typeorm';
import { HTTPController } from '@typeservice/http';
import { TPackageMaintainerState } from './maintainer';
import { VersionEntity } from '@nppm/entity';
import { nanoid } from 'nanoid';
import { TPackageStreamState } from './package.interface';
import { versionAllowed } from '@nppm/utils';
import { HttpUnprocessableEntityException } from '@typeservice/exception';
import { MD5 } from 'crypto-js';

@HTTPController()
export class HttpVersionService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  public createNewVersion(
    pid: number, 
    filename: string, 
    uid: number, 
    attachment: TPackageStreamState,
    state: TPackageVersionState, 
    Version?: Repository<VersionEntity>
  ) {
    Version = Version || this.connection.getRepository(VersionEntity);
    const version = new VersionEntity();
    version.gmt_modified = new Date();
    version.homepage = state.homepage;
    version.integrity = state.dist.integrity;
    version.license = state.license;
    version.pid = pid;
    version.readme = state.readme;
    version.repository = state.repository || { type: null, url: null };
    version.rev = MD5(nanoid()).toString();
    version.shasum = state.dist.shasum;
    version.tarball = filename;
    version.uid = uid;
    version.attachment_size = attachment.length;
    version.attachment_type = attachment.content_type;
    version.code = state.version;
    version.deprecated = null;
    version.description = state.description;
    version.gmt_create = new Date();
    version.info = {
      keywords: state.keywords,
      dist: state.dist,
      dependencies: state.dependencies,
      // @ts-ignore
      engines: state.engines,
      // @ts-ignore
      _hasShrinkwrap: state._hasShrinkwrap,
      // @ts-ignore
      _nodeVersion: state._nodeVersion,
      // @ts-ignore
      _npmOperationalInternal: state._npmOperationalInternal,
      // @ts-ignore
      _npmVersion: state._npmVersion,
      // @ts-ignore
      bugs: state.bugs,
      // @ts-ignore
      directories: state.directories,
      // @ts-ignore
      main: state.main,
      // @ts-ignore
      module: state.module,
    };
    return Version.save(version);
  }

  public getCountByPackage(pid: number, Version?: Repository<VersionEntity>) {
    Version = Version || this.connection.getRepository(VersionEntity);
    return Version.count({ pid });
  }

  public getVersionById(id: number, Version?: Repository<VersionEntity>) {
    Version = Version || this.connection.getRepository(VersionEntity);
    return Version.findOne(id);
  }

  public getVersionsByPid(pid: number, Version?: Repository<VersionEntity>) {
    Version = Version || this.connection.getRepository(VersionEntity);
    return Version.find({ pid });
  }

  /**
   * 检测当前版本是否可以提交发布
   * @param pid 
   * @param version 
   * @param repository 
   * @returns
   */
  public async canVersionPublish(pid: number, version: string, repository?: Repository<VersionEntity>) {
    repository = repository || this.connection.getRepository(VersionEntity)
    const versionEntities = await this.getVersionsByPid(pid, repository);
    const versions = versionEntities.map(ver => ver.code).sort();
    return versionAllowed(version, versions);
  }

  public async updateDeprecated(rev: string, msg: string, Version?: Repository<VersionEntity>) {
    Version = Version || this.connection.getRepository(VersionEntity);
    const version = await Version.findOne({ rev });
    if (!version) throw new HttpUnprocessableEntityException('can not find the version rev of ' + rev);
    if (version.deprecated !== msg) {
      version.deprecated = msg;
      version.gmt_modified = new Date();
      return await Version.save(version);
    }
  }

  public getVersionByCode(pid: number, code: string, Version?: Repository<VersionEntity>) {
    Version = Version || this.connection.getRepository(VersionEntity);
    return Version.findOne({ pid, code });
  }

  public async removeVersionByCode(pid: number, code: string, Version?: Repository<VersionEntity>) {
    Version = Version || this.connection.getRepository(VersionEntity);
    const version = await Version.findOne({ pid, code });
    if (!version) throw new HttpUnprocessableEntityException('can not find the version code of ' + code);
    await Version.delete(version.id);
    return version;
  }

  public getVersionByRev(rev: string, Version?: Repository<VersionEntity>) {
    Version = Version || this.connection.getRepository(VersionEntity);
    return Version.findOne({ rev });
  }

  public removeAll(pid: number, Version?: Repository<VersionEntity>) {
    Version = Version || this.connection.getRepository(VersionEntity);
    return Version.delete({ pid });
  }
}

export interface TPackageVersionState {
  name: string,
  version: string,
  description: string,
  homepage?: string,
  license?: string,
  keywords?: string[],
  dependencies?: Record<string, string>,
  readme?: string,
  readmeFilename?: string,
  repository?: any,
  _id: string,
  _nodeVersion: string,
  _npmVersion: string,
  _npmUser: TPackageMaintainerState,
  maintainers: TPackageMaintainerState[],
  dist: {
    integrity: string,
    shasum: string,
    tarball: string,
  },
  deprecated?: string,
  rev?: string,
}