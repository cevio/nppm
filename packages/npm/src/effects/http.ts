import * as bodyParser from 'koa-bodyparser';
import { Context, Next } from 'koa';
import { TSchema } from '../interface';
import { createServer, Server } from 'http';
import { createContext } from '@typeservice/process';
import { logger } from '../util';
import { ConfigContext } from './config';
import { HTTP } from '@typeservice/http';
import { container } from '../container';
import { HttpException } from '@typeservice/exception';
import { HttpProxyServices } from '../proxy';

export const HttpServerContext = createContext<Server>();
export const ApplicationContext = createContext<HTTP>();
export async function createHttpServer(schema: TSchema) {
  const port = Number(schema.port || ConfigContext.value.port || 9603);
  const app = new HTTP(container);
  app.use(bodyParser({
    jsonLimit: '500mb'
  }));
  if (schema.dev || ConfigContext.value.dev) {
    app.use(async (ctx, next) => {
      const session = ctx.headers['npm-session'];
      const method = ctx.method;
      const pathname = ctx.request.path;
      console.log('-----------------------');
      console.log('session', session);
      console.log('npm-command', ctx.header['npm-command']);
      console.log('referer', ctx.header.referer);
      console.log('authorization', ctx.header['authorization']);
      console.log('method', method);
      console.log('pathname', pathname);
      console.log('query', ctx.query);
      console.log('body', ctx.request.body);
      await next();
    })
  }
  app.use(ErrorCatch);
  HttpProxyServices.forEach(service => app.createService(service));
  app.use(app.routes());
  const server = createServer(app.callback());
  server.setTimeout(0);
  await new Promise<void>((resolve, reject) => {
    server.listen(port, (err?: any) => {
      if (err) return reject(err);
      resolve();
    })
  })
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
    if (e instanceof HttpException) {
      ctx.status = e.status;
      ctx.body = {
        error: e.code,
        reason: e.message,
      }
    } else {
      ctx.status = 503;
      ctx.body = {
        error: 'SERVICE_UNAVAILABLE',
        reason: e.message,
      }
    }
  }
}