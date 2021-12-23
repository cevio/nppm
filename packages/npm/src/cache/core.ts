import { compile, PathFunction } from 'path-to-regexp';
import { RedisContext } from '../effects';

type TDefaultArguments = Record<string, string | number> | undefined;
type TDefaultResult<O = any> = { data: O, expire?: number };
type TCacheHandler<T extends TDefaultArguments = TDefaultArguments, O = any> = (schema?: T) => Promise<TDefaultResult<O>>

export class CacheAble<
  T extends TDefaultArguments = TDefaultArguments, 
  O = any
> {
  private readonly toPath: PathFunction<T>;
  private readonly handler: TCacheHandler<T, O>;
  private readonly namespace: string;
  private readonly memory: boolean;
  private value: O;
  private timer: NodeJS.Timer;

  constructor(options: {
    namespace?: string,
    path: string, 
    handler: TCacheHandler<T, O>,
    memory?: boolean,
  }) {
    this.toPath = compile(options.path, { encode: encodeURIComponent });
    this.handler = options.handler;
    this.namespace = options.namespace || 'npm';
    this.memory = !!options.memory;
  }

  get redis() {
    return RedisContext.value;
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

  public async build(args?: T) {
    const path = this.toKey(args);
    const { data, expire } = await this.handler(args);
    if (this.memory) this.value = data;
    await this.redis.set(path, JSON.stringify(data));
    if (expire !== undefined && expire >= 0) {
      await this.redis.expire(path, expire);
      if (this.memory) this.startTimer(expire);
    }
    return data;
  }

  public async get(args?: T) {
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
    return await this.build(args);
  }
}