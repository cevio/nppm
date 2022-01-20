import { CacheAble } from '@nppm/utils';
import { PackageEntity, VersionEntity, UserEntity, TagEntity, MaintainerEntity } from '@nppm/entity';
import { Connection, EntityManager, In } from 'typeorm';
import { HttpUnprocessableEntityException } from '@typeservice/exception';

export const PackageCacheAble = new CacheAble<any, [Connection | EntityManager], { pkg: string }>({
  memory: false,
  path: '/package/:pkg',
  async handler(args, connection) {
    const pkg = args.pkg;
    const Packages = connection.getRepository(PackageEntity);
    const Tag = connection.getRepository(TagEntity);
    const pack = await Packages.findOne({ pathname: pkg });

    if (!pack) {
      throw new HttpUnprocessableEntityException('can not find package:' + pkg);
    }

    const versions = await createVersions(pack.id, pack.pathname, connection);
    const tags = await Tag.find({ pid: pack.id });
    const latestTag = tags.find(tag => tag.namespace === 'latest');
    const latestVersion = versions.find(version => version.id === latestTag.vid);
    const distTags = createDistTags(tags, versions);

    return {
      data: {
        _id: pack.pathname,
        _rev: pack.rev,
        name: pack.pathname,
        versions: formatVersions(versions),
        description: latestVersion.description,
        homepage: latestVersion.homepage,
        repository: latestVersion.repository,
        'dist-tags': distTags,
        bugs: latestVersion.bugs,
        keywords: latestVersion.keywords,
        license: latestVersion.license,
        maintainers: latestVersion.maintainers,
        readme: latestVersion.readme,
        time: {
          created: pack.gmt_create,
          modified: pack.gmt_modified,
          ...createTimes(versions),
        }
      },
    }
  }
})

function createDistTags(tags: TagEntity[], versions: any[]) {
  const res: Record<string, string> = {};
  const _versions: Map<number, string> = new Map();
  versions.forEach(version => _versions.set(version.id, version.version));
  tags.forEach(tag => res[tag.namespace] = _versions.get(tag.vid));
  return res;
}

async function createVersions(pid: number, pathname: string, connection: Connection | EntityManager) {
  const Version = connection.getRepository(VersionEntity);
  const versions = await Version.find({ pid });
  const maintainers = await getMaintainers(pid, connection);
  const users = await createUsers(versions.map(version => version.uid), connection);
  return versions.map(version => {
    const user = users.find(user => user.id === version.uid);
    const dist = Object.assign(version.info.dist, {
      tarball: `/~/download/${version.rev}.tgz`,
    })
    return Object.assign(version.info, {
      id: version.id,
      description: version.description,
      homepage: version.homepage,
      license: version.license,
      maintainers,
      name: pathname,
      readme: version.readme,
      repository: version.repository,
      version: version.code,
      _id: pathname,
      _npmUser: user ? { name: user.account, email: user.email } : undefined,
      dist,
      _time: {
        create: version.gmt_create,
        modified: version.gmt_modified,
      },
      _rev: version.rev,
      deprecated: version.deprecated || undefined,
    })
  })
}

function createUsers(ids: number[], connection: Connection | EntityManager) {
  const User = connection.getRepository(UserEntity);
  return User.find({ id: In(ids) })
}

function getMaintainers(pid: number, connection: Connection | EntityManager): Promise<{ name: string, email: string }[]> {
  const Maintainer = connection.getRepository(MaintainerEntity);
  return Maintainer.createQueryBuilder('maintainer')
    .leftJoinAndSelect(UserEntity, 'user', 'user.id=maintainer.uid')
    .select('user.account', 'name')
    .addSelect('user.email', 'email')
    .where('maintainer.pid=:pid', { pid })
    .getRawMany()
}

function createTimes(versions: any[]) {
  const res: Record<string, Date> = {};
  versions.forEach(version => {
    res[version.version] = version._time.create;
  })
  return res;
}

function formatVersions(versions: any[]) {
  const res: Record<string, any> = {};
  versions.forEach(version => {
    delete version.id;
    res[version.version] = version;
  })
  return res;
}