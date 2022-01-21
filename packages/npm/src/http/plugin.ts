import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HttpServiceUnavailableException } from '@typeservice/exception';
import { HTTPController, HTTPRouter, HTTPRequestBody, HTTPRouterMiddleware, HTTPRequestParam } from '@typeservice/http';
import { UserInfoMiddleware, UserMustBeAdminMiddleware, UserMustBeLoginedMiddleware, UserNotForbiddenMiddleware } from '@nppm/utils';

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
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public async installPlugin(@HTTPRequestBody() body: { name: string, registry?: string, dev?: boolean }) {
    const suceess = await this.npmcore.install(body.name, body.dev, body.registry);
    if (!suceess) throw new HttpServiceUnavailableException('安装插件失败');
  }

  @HTTPRouter({
    pathname: '/~/plugin/:pkg',
    methods: 'DELETE'
  })
  // /Users/evioshen/code/github/nppm/packages/dingtalk
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public unInstallPlugin(@HTTPRequestParam('pkg') name: string) {
    return this.npmcore.uninstall(name);
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
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
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
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
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
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public savePluginConfigs(
    @HTTPRequestParam('pkg') name: string,
    @HTTPRequestBody() body: Record<string, any>,
  ) {
    return this.npmcore.savePluginConfigs(name, body);
  }
}