import { ParameterMetaCreator } from '@typeservice/decorator';
import { Context } from 'koa';

export function NPMSession() {
  return ParameterMetaCreator.define((ctx: Context) => {
    return ctx.header['npm-session'];
  })
}