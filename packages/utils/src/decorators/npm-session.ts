import { ParameterMetaCreator } from '@typeservice/decorator';
import { Context } from 'koa';
import { MD5 } from 'crypto-js';
import { nanoid } from 'nanoid';

export function NPMSession() {
  return ParameterMetaCreator.define((ctx: Context) => {
    return ctx.header['npm-session'] || MD5(nanoid());
  })
}