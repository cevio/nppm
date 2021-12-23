import * as Router from 'koa-router-find-my-way';
import * as bodyParser from 'koa-bodyparser';
import Koa, { Context, Next } from 'koa';
import { TSchema } from '../interface';
import { createServer, Server } from 'http';
import { createContext } from '@nppm/process';
import { logger } from '../util';
import { ConfigContext } from './config';
import { Exception } from '@nppm/toolkit';

export const HttpRouteContext = createContext<Router.Instance>();
export const HttpServerContext = createContext<Server>();
export const ApplicationContext = createContext<Koa>();
export async function createHttpServer(schema: TSchema) {
  const port = Number(schema.port || ConfigContext.value.port || 9603);
  const app = new Koa();
  const router = Router();
  app.use(bodyParser());
  if (schema.dev || ConfigContext.value.dev) {
    app.use(async (ctx, next) => {
      const session = ctx.headers['npm-session'];
      const method = ctx.method;
      const pathname = ctx.request.path;
      console.log('-----------------------');
      console.log('session', session);
      console.log('authorization', ctx.header['authorization']);
      console.log('method', method);
      console.log('pathname', pathname);
      console.log('query', ctx.query);
      console.log('body', ctx.request.body);
      await next();
    })
  }
  app.use(ErrorCatch);
  app.use(router.routes());
  const server = createServer(app.callback());
  server.setTimeout(0);
  await new Promise<void>((resolve, reject) => {
    server.listen(port, (err?: any) => {
      if (err) return reject(err);
      resolve();
    })
  })
  HttpRouteContext.setContext(router);
  HttpServerContext.setContext(server);
  ApplicationContext.setContext(app);
  logger.warn('HTTP start on port:', port)
  return () => {
    server.close();
  }
}

async function ErrorCatch(ctx: Context, next: Next) {
  try{
    await next();
  } catch (e) {
    if (e instanceof Exception) {
      ctx.status = e.code;
      ctx.body = {
        error: 'ECODE:' + e.code,
        reason: e.message,
      }
    } else {
      ctx.status = 500;
      ctx.body = {
        error: 'ECODE:500',
        reason: e.message,
      }
    }
  }
}