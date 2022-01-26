import { Context, Next } from 'koa';
import { HttpNotAcceptableException } from '@typeservice/exception';

export function NpmCommanderLimit(...commanders: string[]) {
  return async (ctx: Context, next: Next) => {
    const commander = ((ctx.header['npm-command'] || ctx.header['referer']) as string) || '';
    if (commanders.includes(commander.split(' ')[0])) return await next();
    throw new HttpNotAcceptableException('Not accept commander:' + commander);
  }
}

export async function OnlyRunInCommanderLineInterface(ctx: Context, next: Next) {
  const useragent = ctx.header['user-agent'];
  if (!/npm\/\d+\.\d+\.\d+/.test(useragent)) throw new HttpNotAcceptableException('Not support api');
  await next();
}