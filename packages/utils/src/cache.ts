import { compile, PathFunction } from 'path-to-regexp';
import { REDIS_CONNECTION_CONTEXT } from './redis';

type TDefaultArguments = Record<string, string | number> | undefined;
type TDefaultResult<O = any> = { data: O, expire?: number };
type TCacheHandler<T extends TDefaultArguments = TDefaultArguments, O = any, R extends any[] = []> = (schema?: T, ...args: R) => Promise<TDefaultResult<O>>;

export class CacheAble<
  O = any,
  R extends any[] = [],
  T extends TDefaultArguments = TDefaultArguments, 
> {
  private readonly toPath: PathFunction<T>;
  private readonly handler: TCacheHandler<T, O, R>;
  private readonly namespace: string;
  private readonly memory: boolean;
  private value: O;
  private timer: NodeJS.Timer;
  private _redis: typeof REDIS_CONNECTION_CONTEXT.value;

  constructor(options: {
    namespace?: string,
    path: string, 
    handler: TCacheHandler<T, O, R>,
    memory?: boolean,
  }) {
    this.toPath = compile(options.path, { encode: encodeURIComponent });
    this.handler = options.handler;
    this.namespace = options.namespace || 'npm';
    this.memory = !!options.memory;
  }

  get redis() {
    return REDIS_CONNECTION_CONTEXT.value || this._redis;
  }

  set redis(obj: typeof REDIS_CONNECTION_CONTEXT.value) {
    this._redis = obj;
  }

  private startTimer(time: number) {
    clearTimeout(this.timer);
    if (time < 0) return;
    this.timer = setTimeout(() => {
      this.value = undefined;
    }, time);
  }

  private toKey(args?: T) {
    return this.namespace + ':' + this.toPath(args);
  }

  public async build(args?: T, ...extras: R) {
    const path = this.toKey(args);
    const { data, expire } = await this.handler(args, ...extras);
    if (this.memory) this.value = data;
    await this.redis.set(path, JSON.stringify(data));
    if (expire !== undefined && expire >= 0) {
      await this.redis.expire(path, expire);
      if (this.memory) this.startTimer(expire);
    }
    return data;
  }

  public async get(args?: T, ...extras: R) {
    if (this.memory) {
      if (this.value !== undefined) return this.value;
    }
    const path = this.toKey(args);
    if (await this.redis.exists(path)) {
      const dataFromRedis = JSON.parse(await this.redis.get(path)) as O;
      if (this.memory) {
        this.value = dataFromRedis;
        this.startTimer(await this.redis.ttl(path));
      }
      return dataFromRedis;
    }
    return await this.build(args, ...extras);
  }
}