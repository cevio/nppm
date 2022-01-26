import { Context, Next } from 'koa';
import { Exception } from '@typeservice/exception';

export async function createErrorCatchMiddleware(ctx: Context, next: Next) {
  try {
    await next();
  } catch (e) {
    if (e instanceof Exception) {
      ctx.status = e.status;
      ctx.body = e.message;
    } else {
      ctx.status = 503;
      ctx.body = e.message;
    }
  }
}