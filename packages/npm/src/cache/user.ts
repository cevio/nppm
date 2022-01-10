import { CacheAble } from './core';
import { UserEntity } from '@nppm/entity';
import { ORMContext } from '../effects';

export const UserCacheAble = new CacheAble<{ id: number }, UserEntity>({
  memory: false,
  path: '/user/:id(\\d+)',
  async handler({ id }) {
    const connection = ORMContext.value;
    const entity = connection.manager.getRepository(UserEntity);
    return {
      data: await entity.findOne(id),
    }
  }
})