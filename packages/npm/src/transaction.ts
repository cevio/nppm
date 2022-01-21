import { inject, injectable } from 'inversify';
import { NPMCore } from '@nppm/core';
import { QueryRunner } from 'typeorm';

@injectable()
export class HttpTransactionService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  public async transaction<T>(fn: (runner: QueryRunner, rollbacks: (() => void | Promise<void>)[]) => Promise<T>) {
    const rollbacks: (() => void | Promise<void>)[] = [];
    const runner = this.connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const res = await fn(runner, rollbacks);
      await runner.commitTransaction();
      return res;
    } catch (e) {
      await runner.rollbackTransaction();
      let i = rollbacks.length;
      while (i--) await Promise.resolve(rollbacks[i]());
      throw e;
    } finally {
      await runner.release();
    }
  }
}
