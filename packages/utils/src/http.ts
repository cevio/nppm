import * as bodyParser from 'koa-bodyparser';
import { Middleware } from 'koa';
import { createServer, Server } from 'http';
import { interfaces } from 'inversify';
import { HTTP } from '@typeservice/http';
import { createContext } from '@typeservice/process';
import { container } from './container';

export const HTTP_SERVER_CONTEXT = createContext<Server>();
export const HTTP_APPLICATION_CONTEXT = createContext<HTTP>();

export interface TCreateHttpServerProps {
  readonly port: number,
  readonly middlewares?: Middleware[],
  readonly services?: interfaces.Newable<unknown>[],
  readonly keys?: string[],
  readonly bodyParser?: bodyParser.Options
}

export function createHttpServer(props: TCreateHttpServerProps) {
  return async () => {
    const app = new HTTP(container);
    app.keys = props.keys;
    app.use(bodyParser(props.bodyParser));
    if (props.middlewares && props.middlewares.length) {
      props.middlewares.forEach(middleware => app.use(middleware));
    }
    if (props.services && props.services.length) {
      props.services.forEach(service => app.createService(service));
    }
    app.use(app.routes());
    const server = createServer(app.callback());
    server.setTimeout(0);
    await new Promise<void>((resolve, reject) => {
      server.listen(props.port, (err?: any) => {
        if (err) return reject(err);
        resolve();
      })
    })
    HTTP_SERVER_CONTEXT.setContext(server);
    HTTP_APPLICATION_CONTEXT.setContext(app);
    return () => server.close();
  }
}