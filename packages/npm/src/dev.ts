import { Context, Next } from 'koa';
import { isProduction, logger } from '@nppm/utils';
export async function createDevelopmentMiddleware(ctx: Context, next: Next) {
  if (isProduction) return await next();
  const session = ctx.headers['npm-session'];
  const method = ctx.method;
  const pathname = ctx.request.path;
  logger.info('-----------------------');
  logger.info('session', session);
  logger.info('npm-command', ctx.header['npm-command']);
  logger.info('referer', ctx.header.referer);
  logger.info('authorization', ctx.header['authorization']);
  logger.info('method', method);
  logger.info('pathname', pathname);
  logger.info('query', ctx.query);
  logger.info('body', ctx.request.body);
  await next();
}