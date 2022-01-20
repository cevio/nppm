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
  const session = ctx.header['npm-session'];
  if (!session) throw new HttpNotAcceptableException('Not support api');
  await next();
}