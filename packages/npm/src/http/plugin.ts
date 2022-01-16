import { inject } from 'inversify';
import { ConfigCacheAble, UserCountCacheAble } from '@nppm/cache';
import { ConfigEntity } from '@nppm/entity';
import { NPMCore } from '@nppm/core';
import { HttpNotAcceptableException, HttpNotFoundException, HttpServiceUnavailableException } from '@typeservice/exception';
import { HTTPController, HTTPRouter, HTTPRequestBody } from '@typeservice/http';
import { ORM_CONNECTION_CONTEXT, REDIS_CONNECTION_CONTEXT, TORMConfigs, TCreateRedisServerProps } from '@nppm/utils';

@HTTPController()
export class HttpPluginService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/~/plugin',
    methods: 'POST'
  })
  // /Users/evioshen/code/github/nppm/packages/dingtalk
  public async getWebsiteMode(@HTTPRequestBody() body: { name: string, registry?: string }) {
    const suceess = await this.npmcore.install(body.name, body.registry);
    if (!suceess) throw new HttpServiceUnavailableException('安装插件失败');
  }
}