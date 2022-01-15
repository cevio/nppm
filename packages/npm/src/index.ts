import HttpServices from './http';
import { TSchema } from './interface';
import { createSchemaServer } from './schema';
import { createErrorCatchMiddleware } from './error';
import { createDevelopmentMiddleware } from './dev';
import { NPMCore } from '@nppm/core';
import { createProcess, localhost } from '@typeservice/process';
import { logger, createHttpServer, container } from '@nppm/utils';
import { ConfigEntity, DependencyEntity, KeywordEntity, MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity } from '@nppm/entity';

const npmcore = new NPMCore();
const [bootstrap, lifecycle, schema] = createProcess<TSchema>(e => logger.error(e));
npmcore.addORMEntities(ConfigEntity, DependencyEntity, KeywordEntity, MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity);
container.bind('npmcore').toConstantValue(npmcore);

lifecycle
  .createServer(createSchemaServer)
  .createServer(npmcore.configs.createConfigServer())
  .createServer(createHttpServer({
    port: Number(schema.port),
    jsonLimit: '500mb',
    middlewares: [createErrorCatchMiddleware, createDevelopmentMiddleware],
    services: HttpServices,
  }))
  .createServer(npmcore.createApplicationServer())
  .createServer(npmcore.createORMServer())
  .createServer(npmcore.createRedisServer());

bootstrap().then(() => logger.info('NPM服务已启动', `http://${localhost}:${schema.port}`));