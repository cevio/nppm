import { ConfigContext } from './config';
import { createContext } from '@nppm/process';
import { createORMServer, closeORMServer } from '@nppm/entity';
import { ConfigCacheAble } from '../cache';

export const ORMContext = createContext<Parameters<typeof closeORMServer>[0]>();

export async function ORM() {
  const configs = ConfigContext.value.orm;
  const connection = await createORMServer(configs, true);
  ORMContext.setContext(connection);
  await ConfigCacheAble.build();
  return () => closeORMServer(connection);
}