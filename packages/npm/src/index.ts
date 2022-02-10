import HttpServices from './http';
import { TSchema } from './interface';
import { createSchemaServer } from './schema';
import { NPMCore } from '@nppm/core';
import { createProcess, localhost } from '@typeservice/process';
import { logger, createHttpServer, container, isProduction } from '@nppm/utils';
import { createDevelopmentMiddleware, createErrorCatchMiddleware, StaticMiddleware } from './middlewares';
import { ConfigEntity, DependencyEntity, KeywordEntity, MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity, DowloadEntity } from '@nppm/entity';

const npmcore = new NPMCore();
const [bootstrap, lifecycle, schema] = createProcess<TSchema>(e => logger.error(e));
npmcore.addORMEntities(ConfigEntity, DependencyEntity, KeywordEntity, MaintainerEntity, PackageEntity, TagEntity, UserEntity, VersionEntity, DowloadEntity);
container.bind('npmcore').toConstantValue(npmcore);

lifecycle
  .createServer(createSchemaServer)
  .createServer(npmcore.configs.createConfigServer())
  .createServer(createHttpServer({
    port: Number(schema.port),
    middlewares: [StaticMiddleware, createErrorCatchMiddleware, createDevelopmentMiddleware],
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

export function createServer(callback: (localhost: string, schema: TSchema) => void) {
  return bootstrap().then(() => callback(localhost, schema));
}

if (!isProduction) createServer((host, schema) => logger.info('NPM服务已启动', `http://${host}:${schema.port}`));