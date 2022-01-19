import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { Repository } from 'typeorm';
import { HTTPController } from '@typeservice/http';
import { TPackageMaintainerState } from './maintainer';
import { VersionEntity } from '@nppm/entity';
import { nanoid } from 'nanoid';
import { TPackageStreamState } from './package';

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
    version.rev = nanoid();
    version.shasum = state.dist.shasum;
    version.tarball = filename;
    version.uid = uid;
    version.attachment_size = attachment.length;
    version.attachment_type = attachment.content_type;
    version.code = state.version;
    version.deprecated = null;
    version.description = state.description;
    version.gmt_create = new Date();
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
    const versionSemver = this.formatVersionSemver(version);
    const vers: string[] = [];
    versions.forEach(version => {
      const { major, minor, patch } = this.formatVersionSemver(version);
      if (Number(versionSemver.major) >= Number(major) && Number(versionSemver.minor) >= Number(minor) && Number(versionSemver.patch) >= Number(patch)) {
        vers.push(version);
      }
    })
    return true;
  }

  private formatVersionSemver(version: string) {
    const sp = version.split('-');
    const a = sp[0];
    const b = sp[1];
    const c = a.split('.');
    const major = c[0];
    const minor = c[1];
    const patch = c[2];
    return { major, minor, patch, prerelease: b }
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
}

interface TVersionCompareTree {
  items?: {
    [id:string]: TVersionCompareTree
  },
  max: number,
}