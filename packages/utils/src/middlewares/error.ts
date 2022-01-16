import { Context, Next } from 'koa';
import { Exception } from '@typeservice/exception';
export async function createNPMErrorCatchMiddleware(ctx: Context, next: Next) {
  try {
    await next();
    if (ctx.status >= 400 || ctx.status === 202) {
      ctx.body = createErrorResult(ctx.body)
    }
  } catch (e) {
    if (e instanceof Exception) {
      ctx.status = e.status;
      ctx.body = createErrorResult(e.message);
    } else {
      ctx.status = 503;
      ctx.body = createErrorResult(e.message);
    }
  }
}

function createErrorResult<T>(data: T) {
  return {
    error: data,
    reason: data,
  }
}