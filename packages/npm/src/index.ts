import HttpServices from './http';
import { TSchema } from './interface';
import { createSchemaServer } from './schema';
import { NPMCore } from '@nppm/core';
import { createProcess, localhost } from '@typeservice/process';
import { logger, createHttpServer, container } from '@nppm/utils';
import { createDevelopmentMiddleware, createErrorCatchMiddleware } from './middlewares';
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
    middlewares: [createErrorCatchMiddleware, createDevelopmentMiddleware],
    services: HttpServices,
    keys: ['nppm'],
    bodyParser: {
      enableTypes: ['json', 'text'],
      jsonLimit: '500mb',
      strict: false,
    }
  }))
  .createServer(npmcore.createORMServer())
  .createServer(npmcore.createRedisServer())
  .createServer(npmcore.createApplicationServer());

bootstrap().then(() => logger.info('NPM服务已启动', `http://${localhost}:${schema.port}`));