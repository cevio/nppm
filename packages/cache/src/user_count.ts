import { CacheAble } from '@nppm/utils';
import { UserEntity } from '@nppm/entity';
import { Connection, EntityManager } from 'typeorm';

export const UserCountCacheAble = new CacheAble<number, [Connection | EntityManager]>({
  memory: true,
  path: '/users',
  async handler(args, connection) {
    const User = connection.getRepository(UserEntity);
    const count = await User.count();
    return {
      data: count,
    }
  }
})