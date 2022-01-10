import { createProcess } from '@typeservice/process';
import { logger } from './util';
import { createWorker, createConfigs, createHttpServer, ORM, Redis } from './effects';
import { TSchema } from './interface';

const [bootstrap, lifecycle] = createProcess<TSchema>(e => logger.error(e));

lifecycle
  .createServer(createConfigs)
  .createServer(createWorker)
  .createServer(createHttpServer)
  .createServer(Redis)
  .createServer(ORM);

bootstrap().then(() => logger.warn('NPPM REGISTRY STARTED.'));