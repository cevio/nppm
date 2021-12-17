import { Logger } from 'log4js';
import { Radox } from '@nppm/radox';
import { interfaces } from 'inversify';
import { createContext } from './context';

export interface TWorkerProps {
  port: number,
  services: interfaces.Newable<any>[],
  zookeeper: string,
  logger: Logger,
}

export async function Worker(props: TWorkerProps) {
  const radox = new Radox({
    port: props.port,
    zookeeper: props.zookeeper,
    logger: props.logger
  })
  Worker.radox.setContext(radox);
  props.services.forEach(service => radox.define(service));
  await radox.listen();
  return () => radox.close();
}

Worker.radox = createContext<Radox>();