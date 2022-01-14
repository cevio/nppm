import { UserEntity } from '@nppm/entity';
import { CacheAble, ORM_CONNECTION_CONTEXT } from '@nppm/utils';

export const UserCacheAble = new CacheAble<UserEntity, { id: number }>({
  memory: false,
  path: '/user/:id(\\d+)',
  async handler({ id }) {
    const connection = ORM_CONNECTION_CONTEXT.value;
    const entity = connection.manager.getRepository(UserEntity);
    return {
      data: await entity.findOne(id),
    }
  }
})