import { UserEntity } from '@nppm/entity';
import { CacheAble } from '@nppm/utils';
import { Connection, EntityManager } from 'typeorm';

export const UserCacheAble = new CacheAble<UserEntity, [Connection | EntityManager], { id: number }>({
  memory: false,
  path: '/user/:id(\\d+)',
  async handler({ id }, connection) {
    const entity = connection.getRepository(UserEntity);
    return {
      data: await entity.findOne(id),
    }
  }
})