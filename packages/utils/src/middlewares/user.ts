import { Context, Next } from 'koa';
import { UserEntity } from '@nppm/entity';
import { REDIS_CONNECTION_CONTEXT } from '../redis';
import { HttpUnauthorizedException, HttpForbiddenException } from '@typeservice/exception';

export interface UserContext extends Context {
  state: {
    user?: UserEntity
  }
} 

export async function UserInfoMiddleware(ctx: UserContext, next: Next) {
  const authorization = ctx.header['authorization'] as string || ctx.cookies.get('authorization', { signed: true });
  const sp = authorization ? authorization.split(' ') : [];
  if (sp.length !== 2) return await next();
  const redis = REDIS_CONNECTION_CONTEXT.value;
  const key = 'npm:user:' + sp.join(':');
  if (!(await redis.exists(key))) return await next();
  ctx.state.user = JSON.parse(await redis.get(key));
  await next();
}

export async function UserMustBeLoginedMiddleware(ctx: UserContext, next: Next) {
  if (!ctx.state.user) throw new HttpUnauthorizedException('用户未登录');
  await next();
}

export async function UserNotForbiddenMiddleware(ctx: UserContext, next: Next) {
  if (!ctx.state.user.login_forbiden) throw new HttpForbiddenException('用户禁止登录');
  await next();
}

export async function UserMustBeAdminMiddleware(ctx: UserContext, next: Next) {
  if (!ctx.state.user.admin) throw new HttpForbiddenException('非管理员禁止登录');
  await next();
}