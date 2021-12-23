import { Context, Next } from 'koa';
import { UserEntity } from '@nppm/entity';
import { RedisContext } from '../../effects';
import { Exception } from '@nppm/toolkit';

export interface UserContext extends Context {
  user?: UserEntity
} 

export async function UserMiddleware(ctx: UserContext, next: Next) {
  const authorization = ctx.header['authorization'] as string;
  const sp = authorization ? authorization.split(' ') : [];
  if (sp.length !== 2) return await next();
  const redis = RedisContext.value;
  const key = 'npm:user:' + sp.join(':');
  if (!(await redis.exists(key))) return await next();
  ctx.user = JSON.parse(await redis.get(key));
  await next();
}

export async function LoginedMiddleware(ctx: UserContext, next: Next) {
  if (!ctx.user) throw new Exception(401, '未登录的用户');
  if (!ctx.user.login_forbiden) throw new Exception(403, '用户禁止登录');
  await next();
}