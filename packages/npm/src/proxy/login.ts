import { HttpRouteContext } from '../effects';
import { Worker } from '@nppm/process';
import { UserService } from '../service';
import { ConfigCacheAble } from '../cache';

export function LoginProxy() {
  const app = HttpRouteContext.value;
  const radox = Worker.radox.value;

  app.post('/-/v1/login', async ctx => {
    const user = radox.container.get(UserService);
    ctx.body = await user.login(ctx.headers['npm-session'] as string, ctx.request.body);
  })

  app.put('/-/user/org.couchdb.user:account', async ctx => {
    const configs = await ConfigCacheAble.get();
    if (configs.login_code !== 'default') {
      ctx.status = 422;
      ctx.body = {
        error: 'UnacceptLoginType',
        reason: '服务端不接受此登录方式，请联系管理员。',
      }
      return;
    }
    const body = ctx.request.body as { _id: string, name: string, password: string, type: string, roles: string[], data: string, email?: string };
    if (!body.email) {
      ctx.status = 404;
      return ctx.body = null;
    }
    const user = radox.container.get(UserService);
    const code = await user.basedLogin(body.name, body.password, body.email);
    switch (code) {
      case 1:
        ctx.status = 422;
        ctx.body = {
          error: 'Forbiden',
          reason: '用户被禁止登录',
        }
        break;
      case 2:
        ctx.status = 422;
        ctx.body = {
          error: 'Unpassed',
          reason: '用户密码不正确',
        }
        break;
      default:
        ctx.body = {
          ok: true,
          id: 'org.couchdb.user:' + body.name,
        }
    }
  })
}