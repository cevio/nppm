import * as minimist from 'minimist';
import { Logger } from 'log4js';
import { createExitListener } from '@nppm/toolkit';
import { EffectTransaction } from './effect';

export function createProcess<P extends minimist.ParsedArgs>(logger: Logger, errorHandler?: (e: any) => void) {
  const error = errorHandler || ((e: any) => logger.error(e));
  const schema = minimist(process.argv.slice(2)) as P;
  const lifecycle = new EffectTransaction<P>();
  const [listen] = createExitListener();
  const bootstrap = (callback?: (schema: P) => void | Promise<void>) => lifecycle.commit(schema).then(() => {
    process.on('error', error);
    process.on('uncaughtException', error);
    process.on('unhandledRejection', error);
    listen({
      resolve: () => {
        process.off('error', error);
        process.off('uncaughtException', error);
        process.off('unhandledRejection', error);
        return lifecycle.rollback();
      },
      reject: error,
    })
  }).catch(e => lifecycle.rollback().then(() => error(e)).then(() => callback && callback(schema)).finally(() => process.exit(0)));
  return [bootstrap, lifecycle] as const;
}