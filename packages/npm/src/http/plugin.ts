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

  /**
   * 安装插件
   * @param body 
   */
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

  /**
   * 插件安装历史
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/plugin/history',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public getPluginHistory() {
    return Array.from(this.npmcore.installers.values())
      .map(installer => Object.assign({}, installer, { process: undefined }))
      .sort((a, b) => b.startTimeStamp - a.startTimeStamp);
  }

  /**
   * 取消插件安装
   * @param id 
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/plugin/history/cancel/:id(\\d+)',
    methods: 'DELETE'
  })
  // /Users/evioshen/code/github/nppm/packages/dingtalk
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  @HTTPRouterMiddleware(UserMustBeAdminMiddleware)
  public cancelPlugin(@HTTPRequestParam('id') id: string) {
    return this.npmcore.cancelInstallPluginTask(Number(id));
  }

  /**
   * 卸载插件
   * @param name 
   * @returns 
   */
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

  /**
   * 获取所有登录插件列表
   * @returns 
   */
  @HTTPRouter({
    pathname: '/~/plugin/logins',
    methods: 'GET'
  })
  public getAllLogins() {
    return this.npmcore.getLogins();
  }

  /**
   * 获取所有插件
   * @returns 
   */
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

  /**
   * 获取插件的配置数据
   * @param name 
   * @returns 
   */
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

  /**
   * 更新插件的配置数据
   * @param name 
   * @param body 
   * @returns 
   */
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