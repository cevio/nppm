import { UserEntity } from '@nppm/entity';
import { CacheAble } from '@nppm/utils';
import { Connection } from 'typeorm';

export const UserCacheAble = new CacheAble<UserEntity, [Connection], { id: number }>({
  memory: false,
  path: '/user/:id(\\d+)',
  async handler({ id }, connection) {
    const entity = connection.manager.getRepository(UserEntity);
    return {
      data: await entity.findOne(id),
    }
  }
})