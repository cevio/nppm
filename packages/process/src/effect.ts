export type EffectInput<T> = (schema?: T) => void | EffectOutput | Promise<void> | Promise<EffectOutput>;
export type EffectOutput = () => void | Promise<void>;

export class EffectTransaction<T> {
  private readonly stacks: EffectInput<T>[] = [];
  private cancels: EffectOutput[] = [];

  public use(fn: EffectInput<T>) {
    this.stacks.push(fn);
    return this;
  }

  public async commit(schema: T) {
    const error = (e: any) => {
      throw e;
    }
    process.on('error', error)
    process.on('uncaughtException', error)
    process.on('unhandledRejection', error)
    for (let i = 0 ; i < this.stacks.length; i++) {
      const stack = this.stacks[i];
      const output = await Promise.resolve(stack(schema));
      if (typeof output === 'function') {
        this.cancels.push(output);
      }
    }
    process.off('error', error);
    process.off('uncaughtException', error)
    process.off('unhandledRejection', error)
  }

  public async rollback() {
    let i = this.cancels.length;
    while (i--) {
      await Promise.resolve(this.cancels[i]());
    }
  }
}