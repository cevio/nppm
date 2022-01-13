import ioRedis from 'ioredis';
import { createContext } from '@typeservice/process';
import { ref, effect, stop } from '@vue/reactivity';
import { logger } from './logger';

export const REDIS_CONNECTION_CONTEXT = createContext<ioRedis.Redis>();

export interface TCreateRedisServerProps {
  readonly host: string,
  readonly port: number,
  readonly password?: string,
  readonly db?: number
}

export function createRedisServer(props: TCreateRedisServerProps) {
  return async () => {
    const redis = new ioRedis(props);
    await new Promise<void>((resolve, reject) => {
      const onerror = (e: any) => reject(e);
      redis.on('error', onerror);
      redis.on('connect', () => {
        redis.off('error', onerror);
        resolve();
      })
    })
    REDIS_CONNECTION_CONTEXT.setContext(redis);
    return () => redis.disconnect();
  }
}

export const REDIS_HOST = ref<TCreateRedisServerProps['host']>();
export const REDIS_PORT = ref<TCreateRedisServerProps['port']>();
export const REDIS_PASSWORD = ref<TCreateRedisServerProps['password']>();
export const REDIS_DB = ref<TCreateRedisServerProps['db']>();

export function createRedisObserver(props: TCreateRedisServerProps) {
  const doing = createContext(false);
  setRedisState(props);
  return () => {
    const stopEffect = effect(() => {
      if (REDIS_HOST.value && REDIS_PORT.value) {
        if (!doing.value) {
          doing.setContext(true);
          process.nextTick(() => createRedisAsyncServer({
            host: REDIS_HOST.value,
            port: REDIS_PORT.value,
            password: REDIS_PASSWORD.value,
            db: REDIS_DB.value,
          }, () => doing.setContext(false)));
        }
      }
    })
    return () => {
      stop(stopEffect);
      if (REDIS_CONNECTION_CONTEXT.value) {
        REDIS_CONNECTION_CONTEXT.value.disconnect();
      }
    }
  }
}

export function setRedisState(state: TCreateRedisServerProps) {
  REDIS_HOST.value = state.host;
  REDIS_PORT.value = state.port;
  REDIS_PASSWORD.value = state.password;
  REDIS_DB.value = state.db;
}

export function createRedisAsyncServer(props: TCreateRedisServerProps, done: () => void) {
  if (REDIS_CONNECTION_CONTEXT.value) {
    REDIS_CONNECTION_CONTEXT.value.disconnect();
    REDIS_CONNECTION_CONTEXT.setContext(null);
  }
  const redis = new ioRedis(props);
  const onerror = (e: any) => logger.error(e);
  redis.on('error', onerror);
  redis.on('connect', () => {
    redis.off('error', onerror);
    REDIS_CONNECTION_CONTEXT.setContext(redis);
    done();
  })
}