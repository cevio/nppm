import { ParameterMetaCreator } from '@typeservice/decorator';
import { Context } from 'koa';

export function NPMCommander() {
  return ParameterMetaCreator.define((ctx: Context) => {
    return (ctx.header['npm-command'] || ctx.header['referer']) as string;
  })
}