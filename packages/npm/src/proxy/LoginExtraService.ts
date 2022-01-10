import { inject } from 'inversify';
import { UserService } from '../service';
import { RedisContext } from '../effects';
import { UserMiddleware } from './middlewares';
import { UserEntity } from '@nppm/entity';
import { HTTPController, HTTPRouter, HTTPRequestHeader, HTTPRouterMiddleware, HTTPRequestState, HTTPRequestParam } from '@typeservice/http';
import { HttpMovedPermanentlyException, HttpAcceptedException, HttpUnauthorizedException, HttpServiceUnavailableException } from '@typeservice/exception';

@HTTPController()
export class HttpLoginExtraService {
  @inject(UserService) private readonly UserService: UserService;

  @HTTPRouter({
    pathname: '/~/v1/login/authorize',
    methods: 'GET'
  })
  public async getLoginRedirectContent(@HTTPRequestHeader('npm-session') session: string) {
    const { html, url } = await this.UserService.authorize(session);
    if (url) throw new HttpMovedPermanentlyException(url);
    if (html) return html;
  }

  @HTTPRouter({
    pathname: '/~/v1/login/checkable',
    methods: 'GET'
  })
  public async checkLoginRedirectContent(@HTTPRequestHeader('npm-session') session: string) {
    const status = await this.UserService.checkable(session);
    switch (status.code) {
      case 202: 
        const e = new HttpAcceptedException();
        e.set('retry-after', '3');
        throw e;
      case 401: throw new HttpUnauthorizedException(status.msg);
      case 500: throw new HttpServiceUnavailableException(status.msg);
      default: return status.data || {}
    }
  }

  @HTTPRouter({
    pathname: '/-/whoami',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(UserMiddleware)
  public whoami(@HTTPRequestState('user') user: UserEntity) {
    return {
      username: user ? user.nickname : null,
    }
  }

  @HTTPRouter({
    pathname: '/-/user/token/:token',
    methods: 'DELETE'
  })
  public async logout(@HTTPRequestParam('token') token: string) {
    if (token) {
      const redis = RedisContext.value;
      const key = 'npm:user:Bearer:' + token;
      if (await redis.exists(key)) {
        await redis.del(key);
      }
    }
    return {
      ok: true,
    }
  }
}