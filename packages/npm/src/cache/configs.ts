import { CacheAble, ORM_CONNECTION_CONTEXT } from '@nppm/utils';
import { ConfigEntity } from '@nppm/entity';

export const ConfigCacheAble = new CacheAble<ConfigEntity>({
  memory: true,
  path: '/configs',
  async handler() {
    const connection = ORM_CONNECTION_CONTEXT.value;
    const entity = connection.manager.getRepository(ConfigEntity);
    return {
      data: await entity.findOne(),
    }
  }
})