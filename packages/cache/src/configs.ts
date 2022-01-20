import { CacheAble } from '@nppm/utils';
import { ConfigEntity } from '@nppm/entity';
import { Connection, EntityManager } from 'typeorm';

export const ConfigCacheAble = new CacheAble<ConfigEntity, [Connection | EntityManager]>({
  memory: true,
  path: '/configs',
  async handler(args, connection) {
    const entity = connection.getRepository(ConfigEntity);
    return {
      data: await entity.findOne(),
    }
  }
})