import { CacheAble } from '@nppm/utils';
import { UserEntity } from '@nppm/entity';
import { Connection } from 'typeorm';

export const UserCountCacheAble = new CacheAble<number, [Connection]>({
  memory: true,
  path: '/users',
  async handler(args, connection) {
    const User = connection.manager.getRepository(UserEntity);
    const count = await User.count();
    return {
      data: count,
    }
  }
})