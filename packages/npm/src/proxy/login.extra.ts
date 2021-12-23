import { HttpRouteContext } from '../effects';
import { Worker } from '@nppm/process';
import { UserService } from '../service';
import { UserMiddleware, UserContext } from './middlewares';
import { RedisContext } from '../effects';

export function LoginExtraProxy() {
  const app = HttpRouteContext.value;
  const radox = Worker.radox.value;

  app.get('/~/v1/login/authorize', async ctx => {
    const user = radox.container.get(UserService);
    const { html, url } = await user.authorize(ctx.query.session as string);
    if (url) {
      ctx.status = 301;
      return ctx.redirect(url);
    }
    if (html) {
      return ctx.body = html;
    }
  })

  app.get('/~/v1/login/checkable', async ctx => {
    const user = radox.container.get(UserService);
    const status = await user.checkable(ctx.query.session as string);
    if (status.code === 202) {
      ctx.status = 202;
      ctx.set('retry-after', '1');
      ctx.body = {};
    } else if (status.code === 500) {
      ctx.status = 425;
      ctx.body = {
        error: 'E500',
        reason: status.msg,
      }
    } else {
      ctx.body = status.data || {};
    }
  })

  app.get('/-/whoami', UserMiddleware, async (ctx: UserContext) => {
    ctx.body = {
      username: ctx.user ? ctx.user.nickname : null,
    }
  })

  app.delete('/-/user/token/:token', async ctx => {
    if (ctx.params.token) {
      const redis = RedisContext.value;
      const key = 'npm:user:Bearer:' + ctx.params.token;
      if (await redis.exists(key)) {
        await redis.del(key);
      }
    }
    ctx.status = 200;
  })
}