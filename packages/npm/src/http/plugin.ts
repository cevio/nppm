import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HttpServiceUnavailableException } from '@typeservice/exception';
import { HTTPController, HTTPRouter, HTTPRequestBody } from '@typeservice/http';

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
  public async installPlugin(@HTTPRequestBody() body: { name: string, registry?: string, dev?: boolean }) {
    const suceess = await this.npmcore.install(body.name, body.dev, body.registry);
    if (!suceess) throw new HttpServiceUnavailableException('安装插件失败');
  }

  @HTTPRouter({
    pathname: '/~/plugin',
    methods: 'PUT'
  })
  // /Users/evioshen/code/github/nppm/packages/dingtalk
  public unInstallPlugin(@HTTPRequestBody() body: { name: string }) {
    return this.npmcore.uninstall(body.name);
  }

  @HTTPRouter({
    pathname: '/~/plugin/logins',
    methods: 'GET'
  })
  public getAllLogins() {
    return this.npmcore.getLogins();
  }
}