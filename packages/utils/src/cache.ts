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
  private readonly memoryKey: string | ((args: T) => string);
  private value: O | Map<string, O>;
  private timer: NodeJS.Timer;
  private _redis: typeof REDIS_CONNECTION_CONTEXT.value;

  constructor(options: {
    namespace?: string,
    path: string, 
    handler: TCacheHandler<T, O, R>,
    memory?: boolean,
    memoryKey?: string | ((args: T) => string),
  }) {
    this.toPath = compile(options.path, { encode: encodeURIComponent });
    this.handler = options.handler;
    this.namespace = options.namespace || 'npm';
    this.memory = !!options.memory;
    this.memoryKey = options.memoryKey;
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

  private buildMemoryValue(data: O, args: T) {
    if (typeof this.memoryKey === 'string') {
      if (!(this.value instanceof Map)) this.value = new Map();
      (this.value as Map<string, O>).set(this.memoryKey, data);
    } else if (typeof this.memoryKey === 'function') {
      const key = this.memoryKey(args);
      if (!(this.value instanceof Map)) this.value = new Map();
      (this.value as Map<string, O>).set(key, data);
    } else {
      this.value = data;
    }
  }

  private getMemoryValue(args: T) {
    if (typeof this.memoryKey === 'string') {
      if (!(this.value instanceof Map)) return;
      return (this.value as Map<string, O>).get(this.memoryKey);
    } else if (typeof this.memoryKey === 'function') {
      const key = this.memoryKey(args);
      if (!(this.value instanceof Map)) return;
      return (this.value as Map<string, O>).get(key);
    } else {
      return this.value;
    }
  }

  private delMemoryValue(args: T) {
    if (typeof this.memoryKey === 'string') {
      if (!(this.value instanceof Map)) this.value = new Map();
      const memoryKeyStringObject = (this.value as Map<string, O>);
      if (memoryKeyStringObject.has(this.memoryKey)) {
        memoryKeyStringObject.delete(this.memoryKey);
      }
    } else if (typeof this.memoryKey === 'function') {
      const key = this.memoryKey(args);
      if (!(this.value instanceof Map)) this.value = new Map();
      const memoryKeyFunctionObject = (this.value as Map<string, O>);
      if (memoryKeyFunctionObject.has(key)) {
        memoryKeyFunctionObject.delete(key);
      }
    } else {
      this.value === undefined;
    }
  }

  public async build(args?: T, ...extras: R) {
    const path = this.toKey(args);
    const { data, expire } = await this.handler(args, ...extras);
    if (this.memory) this.buildMemoryValue(data, args);
    await this.redis.set(path, JSON.stringify(data));
    if (expire !== undefined && expire >= 0) {
      await this.redis.expire(path, expire);
      if (this.memory) this.startTimer(expire);
    }
    return data;
  }

  public async get(args?: T, ...extras: R): Promise<O> {
    let needUpdateMemory = false;
    if (this.memory) {
      const value = this.getMemoryValue(args);
      if (value !== undefined) return value as O;
      needUpdateMemory = true;
    }
    const path = this.toKey(args);
    if (await this.redis.exists(path)) {
      const dataFromRedis = JSON.parse(await this.redis.get(path)) as O;
      if (needUpdateMemory) {
        this.buildMemoryValue(dataFromRedis, args);
        const ttl = await this.redis.ttl(path);
        if (ttl > -1) this.startTimer(ttl);
      }
      return dataFromRedis;
    }
    return await this.build(args, ...extras);
  }

  public async del(args?: T) {
    if (this.memory) this.delMemoryValue(args);
    const path = this.toKey(args);
    if (await this.redis.exists(path)) {
      await this.redis.del(path);
    }
  }
}