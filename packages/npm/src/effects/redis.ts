import ioRedis from 'ioredis';
import { createContext } from '@nppm/process';
import { ConfigContext } from './config';

export const RedisContext = createContext<ioRedis.Redis>();

export async function Redis() {
  const redis = new ioRedis(ConfigContext.value.redis);
  await new Promise<void>((resolve, reject) => {
    const onerror = (e: any) => reject(e);
    redis.on('error', onerror);
    redis.on('connect', () => {
      redis.off('error', onerror);
      resolve();
    })
  })
  RedisContext.setContext(redis);
  return () => redis.disconnect();
}