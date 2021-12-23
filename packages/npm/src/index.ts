import { createProcess } from '@nppm/process';
import { logger } from './util';
import { createWorker, createConfigs, createHttpServer, ORM, Redis, BizRouter } from './effects';
import { TSchema } from './interface';

const [bootstrap, lifecycle] = createProcess<TSchema>(logger, e => logger.error(e));

lifecycle
  .use(createConfigs)
  .use(createWorker)
  .use(createHttpServer)
  .use(Redis)
  .use(ORM)
  .use(BizRouter);

bootstrap(() => logger.warn('NPPM REGISTRY STARTED.'));