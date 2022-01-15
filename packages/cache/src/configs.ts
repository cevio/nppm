import { CacheAble } from '@nppm/utils';
import { ConfigEntity } from '@nppm/entity';
import { Connection } from 'typeorm';

export const ConfigCacheAble = new CacheAble<ConfigEntity, [Connection]>({
  memory: true,
  path: '/configs',
  async handler(args, connection) {
    const entity = connection.manager.getRepository(ConfigEntity);
    return {
      data: await entity.findOne(),
    }
  }
})