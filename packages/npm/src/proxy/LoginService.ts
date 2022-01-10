import { inject } from 'inversify';
import { UserService } from '../service';
import { ConfigCacheAble } from '../cache';
import { HTTPController, HTTPRouter, HTTPRequestHeader, HTTPRequestBody } from '@typeservice/http';
import { HttpUnprocessableEntityException, HttpNotFoundException, HttpForbiddenException, HttpUnauthorizedException } from '@typeservice/exception';

@HTTPController()
export class HttpLoginService {
  @inject(UserService) private readonly UserService: UserService;

  @HTTPRouter({
    pathname: '/-/v1/login',
    methods: 'POST'
  })
  public checkUserLoginType(
    @HTTPRequestHeader('npm-session') session: string,
    @HTTPRequestBody() body: { hostname: string }
  ) {
    return this.UserService.login(session, body);
  }

  @HTTPRouter({
    pathname: '/-/user/org.couchdb.user:account',
    methods: 'PUT'
  })
  public async createUserLoginModule(
    @HTTPRequestBody() body: { _id: string, name: string, password: string, type: string, roles: string[], data: string, email?: string }
  ) {
    const configs = await ConfigCacheAble.get();
    if (configs.login_code !== 'default') {
      throw new HttpUnprocessableEntityException('服务端不接受此登录方式，请联系管理员。');
    }
    if (!body.email) throw new HttpNotFoundException();
    const code = await this.UserService.basedLogin(body.name, body.password, body.email);
    switch (code) {
      // 禁止登录
      case 1: throw new HttpForbiddenException();

      // 用户名或密码不正确
      case 2: throw new HttpUnauthorizedException();
      
      // 成功
      default: return {
        ok: true,
        id: 'org.couchdb.user:' + body.name,
      }
    }
  }
}