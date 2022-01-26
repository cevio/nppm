import { Context, Next } from 'koa';
import { isProduction, logger } from '@nppm/utils';
export async function createDevelopmentMiddleware(ctx: Context, next: Next) {
  if (isProduction) return await next();
  logger.info('-----------------------');
  logger.info('headers', ctx.header);
  logger.info('method', ctx.method);
  logger.info('pathname', ctx.request.path);
  logger.info('query', ctx.query);
  logger.info('body', ctx.request.body);
  await next();
}