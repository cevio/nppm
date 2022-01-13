import { TSchema } from './interface';
import { logger, createHttpServer, createRadoxServer } from '@nppm/utils';
import { createProcess, localhost } from '@typeservice/process';

const [bootstrap, lifecycle, schema] = createProcess<TSchema>(e => logger.error(e));

lifecycle
  .createServer(schema => createRadoxServer({
    zookeeper: schema.zookeeper,
    services: [],
  })())
  .createServer(schema => createHttpServer({
    port: Number(schema.port),
    jsonLimit: '500mb',
    middlewares: [],
    services: []
  })());

bootstrap().then(() => logger.info('NPM服务已启动', `http://${localhost}:${schema.port}`));