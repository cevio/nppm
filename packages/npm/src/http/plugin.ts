import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HttpServiceUnavailableException } from '@typeservice/exception';
import { HTTPController, HTTPRouter, HTTPRequestBody, HTTPRouterMiddleware, HTTPRequestParam } from '@typeservice/http';
import { UserInfoMiddleware, UserMustBeAdminMiddleware, UserMustBeLoginedMiddleware } from '@nppm/utils';

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
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async installPlugin(@HTTPRequestBody() body: { name: string, registry?: string, dev?: boolean }) {
    const suceess = await this.npmcore.install(body.name, body.dev, body.registry);
    if (!suceess) throw new HttpServiceUnavailableException('安装插件失败');
  }

  @HTTPRouter({
    pathname: '/~/plugin',
    methods: 'PUT'
  })
  // /Users/evioshen/code/github/nppm/packages/dingtalk
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
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

  @HTTPRouter({
    pathname: '/~/plugins',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public getAllPlugins() {
    return this.npmcore.getPlugins();
  }

  @HTTPRouter({
    pathname: '/~/plugin/:pkg/configs',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public getPluginConfigs(@HTTPRequestParam('pkg') name: string) {
    return this.npmcore.loadPluginConfigs(name);
  }

  @HTTPRouter({
    pathname: '/~/plugin/:pkg/configs',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public savePluginConfigs(
    @HTTPRequestParam('pkg') name: string,
    @HTTPRequestBody() body: Record<string, any>,
  ) {
    return this.npmcore.savePluginConfigs(name, body);
  }
}