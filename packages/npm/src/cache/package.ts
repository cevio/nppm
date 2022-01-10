import { CacheAble } from './core';
import { PackageEntity } from '@nppm/entity';
import { ORMContext } from '../effects';

export const PackageCacheAble = new CacheAble<{ pathname: string }, PackageEntity>({
  memory: false,
  path: '/package/:id',
  async handler({ pathname }) {
    const connection = ORMContext.value;
    const pack = connection.getRepository(PackageEntity);
    const data = await pack.findOne({ pathname });
    return {
      data: data || null,
    }
  }
})