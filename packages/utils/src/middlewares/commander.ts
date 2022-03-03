import { Context, Next } from 'koa';
import { HttpNotAcceptableException } from '@typeservice/exception';

const lernaRegexp = /lerna\/\d+\.\d+\.\d+/;
const npmRegexp = /npm\/\d+\.\d+\.\d+/;

export function NpmCommanderLimit(...commanders: string[]) {
  return async (ctx: Context, next: Next) => {
    const commander = ((ctx.header['npm-command'] || ctx.header['referer']) as string) || '';
    if (commanders.includes(commander.split(' ')[0])) return await next();
    throw new HttpNotAcceptableException('Not accept commander:' + commander);
  }
}

export async function OnlyRunInCommanderLineInterface(ctx: Context, next: Next) {
  const useragent = ctx.header['user-agent'];
  const isLerna = lernaRegexp.test(useragent);
  const isNpm = npmRegexp.test(useragent);
  const hasNpmSession = !!ctx.header['npm-session'];
  if (isLerna) {
    if (!hasNpmSession) throw new HttpNotAcceptableException('Not support api');
    if (ctx.request.body?._attachments && Object.keys(ctx.request.body._attachments).length) {
      ctx.header['npm-command'] = 'publish';
    }
  } else if (!isNpm) {
    throw new HttpNotAcceptableException('Not support api');
  } else {
    await next();
  }
}