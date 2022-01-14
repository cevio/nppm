import HttpServices from './http';
import { TSchema } from './interface';
import { createSchemaServer } from './schema';
import { createErrorCatchMiddleware } from './error';
import { createConfigServer, CONFIGS } from './configs';
import { createProcess, localhost } from '@typeservice/process';
import { logger, createHttpServer, createRadoxServer, createORMObserver, createRedisObserver, isProduction } from '@nppm/utils';
import { ConfigEntity, DependencyEntity, KeywordEntity, MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';

const [bootstrap, lifecycle, schema] = createProcess<TSchema>(e => logger.error(e));

lifecycle
  .createServer(createSchemaServer)
  .createServer(createConfigServer)
  .createServer(createRadoxServer({
    zookeeper: schema.zookeeper,
    services: [],
  }))
  .createServer(createHttpServer({
    port: Number(schema.port),
    jsonLimit: '500mb',
    middlewares: [createErrorCatchMiddleware],
    services: HttpServices,
  }))
  .createServer(() => createORMObserver({
    synchronize: !isProduction,
    entities: [ConfigEntity, DependencyEntity, KeywordEntity, MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity],
    configs: CONFIGS.value.orm,
  })())
  .createServer(() => createRedisObserver(CONFIGS.value.redis)());

bootstrap().then(() => logger.info('NPM服务已启动', `http://${localhost}:${schema.port}`));