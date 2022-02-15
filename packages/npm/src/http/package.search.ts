import axios from 'axios';
import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { resolve } from 'url';
import { ConfigCacheAble } from '@nppm/cache';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestQuery } from '@typeservice/http';
import { createNPMErrorCatchMiddleware, NpmCommanderLimit, OnlyRunInCommanderLineInterface } from '@nppm/utils';
import { MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';

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
  @HTTPRouterMiddleware(NpmCommanderLimit('search'))
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

  private async getFromDatebase(query: { text: string | string[], from: number, size: number }) {
    const Packages = this.connection.getRepository(PackageEntity);
    const result = await Packages.createQueryBuilder('pack')
      .leftJoin(VersionEntity, 'version', 'version.pid=pack.id')
      .leftJoin(TagEntity, 'tag', 'tag.vid=version.id')
      .leftJoin(UserEntity, 'user', 'user.id=version.uid')
      .leftJoin(UserEntity, 'user2', 'user2.id=pack.uid')
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
      .addSelect('user2.account', 'packuseraccount')
      .addSelect('user2.email', 'packuseremail')
      .addSelect('user2.nickname', 'packusernickname')
      .where(`pack.pathname LIKE :keyword`, { keyword: '%' + query.text + '%' })
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
      }
      res.author = {
        name: res.packusernickname,
        email: res.packuseremail,
        username: res.packuseraccount,
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