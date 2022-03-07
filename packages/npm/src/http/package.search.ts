import axios from 'axios';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { resolve } from 'url';
import { ConfigCacheAble } from '@nppm/cache';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestQuery } from '@typeservice/http';
import { createNPMErrorCatchMiddleware, OnlyRunInCommanderLineInterface } from '@nppm/utils';
import { KeywordEntity, MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';

@HTTPController()
export class HttpPackageSearchService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/-/v1/search',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  // https://registry.npmjs.com/-/v1/search?text=node-modules&size=2
  public async search(@HTTPRequestQuery() query: Record<'text' | 'size' | 'from' | 'quality' | 'popularity' | 'maintenance', string>) {
    const result = await this.getFromDatebase({ text: query.text, from: Number(query.from), size: Number(query.size) });
    const out = result.map(res => ({ package: this.signPackagePrivate(res) }));
    if (result.length < Number(query.size)) {
      const ajax = await axios.get('https://registry.npmjs.com/-/v1/search', { params: query });
      out.push(...ajax.data.objects);
    }
    return {
      objects: out
    };
  }

  @HTTPRouter({
    pathname: '/~/search',
    methods: 'GET'
  })
  public async webSearch(
    @HTTPRequestQuery('q') keyword: string,
    @HTTPRequestQuery('o') offset: string,
    @HTTPRequestQuery('s') size: string,
    @HTTPRequestQuery('t') type: 'private' | 'public' = 'private',
  ) {
    if (!keyword) return [];
    const _offset = Number(offset || 0);
    const _size = Number(size || 15);
    const searchParams = { text: keyword, from: _offset, size: _size };
    switch (type) {
      case 'private':
        const result = await this.getFromDatebase(searchParams);
        return result.map(res => ({ package: res }));
      case 'public':
        const remote = await axios.get('https://registry.npmjs.com/-/v1/search', { params: searchParams });
        return remote.data.objects;
      default: return [];
    }
  }

  private async getFromDatebase(query: { text: string | string[], from: number, size: number }) {
    const Packages = this.connection.getRepository(PackageEntity);
    const result = await Packages.createQueryBuilder('pack')
      .leftJoin(VersionEntity, 'version', 'version.pid=pack.id')
      .leftJoin(TagEntity, 'tag', 'tag.vid=version.id')
      .leftJoin(UserEntity, 'user', 'user.id=version.uid')
      .leftJoin(UserEntity, 'user2', 'user2.id=pack.uid')
      .leftJoin(KeywordEntity, 'keyword', 'keyword.vid=version.id')
      .select('pack.pathname', 'name')
      .addSelect('pack.id', 'id')
      .addSelect('pack.scope', 'scope')
      .addSelect('version.code', 'version')
      .addSelect('version.description', 'description')
      .addSelect('version.gmt_modified', 'date')
      .addSelect('version.homepage', 'homepage')
      .addSelect('version.repository', 'repository')
      .addSelect('version.info', 'info')
      .addSelect('user.account', 'publisherusername')
      .addSelect('user.email', 'publisheruseremail')
      .addSelect('user.avatar', 'publisheruseravatar')
      .addSelect('user2.account', 'packuseraccount')
      .addSelect('user2.email', 'packuseremail')
      .addSelect('user2.nickname', 'packusernickname')
      .addSelect('user2.avatar', 'packuseravatar')
      .where(`(pack.pathname LIKE :keyword OR keyword.name LIKE :keyword)`, { keyword: '%' + query.text + '%' })
      .andWhere('tag.vid=version.id')
      .andWhere(`tag.namespace='latest'`)
      .orderBy({ 'pack.gmt_modified': 'DESC' })
      .offset(query.from)
      .limit(query.size)
      .getRawMany();

    const packageIds = result.map(res => res.id);
    const maintainers = await this.getMaintainers(packageIds);
    const configs = await ConfigCacheAble.get(null, this.connection);
    return result.map(res => {
      if (res.scope) res.scope = res.scope.startsWith('@') ? res.scope.substring(1) : res.scope;
      res.keywords = res.info.keywords;
      res.links = {
        npm: resolve(configs.domain, '/package/' + res.name),
        homepage: res.homepage,
        bugs: res.info.bugs,
        repository: res?.repository?.url,
      }
      res.publisher = {
        email: res.publisheruseremail,
        username: res.publisherusername,
        avatar: res.publisheruseravatar,
      }
      res.author = {
        name: res.packusernickname,
        email: res.packuseremail,
        username: res.packuseraccount,
        avatar: res.packuseravatar,
      }
      res.maintainers = maintainers[res.id];
      res.pathname = res.name;
      delete res.id;
      delete res.publisheruseremail;
      delete res.publisherusername;
      delete res.packusernickname;
      delete res.packuseremail;
      delete res.packuseraccount;
      delete res.homepage;
      delete res.repository;
      delete res.info;
      return res;
    })
  }

  private async getMaintainers(ids: number[]) {
    if (!ids.length) return {};
    type TResult = { pid: number, username: string, email: string }
    const Maintainer = this.connection.getRepository(MaintainerEntity);
    const result: TResult[] = await Maintainer.createQueryBuilder('maintainer')
      .leftJoin(UserEntity, 'user', 'user.id=maintainer.uid')
      .select('user.account', 'username')
      .addSelect('user.email', 'email')
      .addSelect('maintainer.pid', 'pid')
      .where('maintainer.pid IN (:pids)', { pids: ids })
      .getRawMany();
    
    const pool: Record<string, Omit<TResult, 'pid'>[]> = {}
    result.forEach(res => {
      if (!pool[res.pid]) pool[res.pid] = [];
      const chunk = pool[res.pid];
      chunk.push({
        username: res.username,
        email: res.email,
      })
    })
    return pool;
  }

  private signPackagePrivate(data: { name: string }) {
    data.name = '[' + data.name + ']';
    return data;
  }
}