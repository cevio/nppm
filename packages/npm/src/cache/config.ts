import { CacheAble } from './core';
import { ConfigEntity } from '@nppm/entity';
import { ORMContext } from '../effects';

export const ConfigCacheAble = new CacheAble<undefined, ConfigEntity>({
  memory: true,
  path: '/configs',
  async handler() {
    const connection = ORMContext.value;
    const entity = connection.manager.getRepository(ConfigEntity);
    return {
      data: await entity.findOne(),
    }
  }
})