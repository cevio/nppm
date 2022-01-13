import { checkPort, pickFreePort } from './port';
import { interfaces } from 'inversify';
import { Radox } from '@typeservice/radox';
import { container } from './container';
import { createContext } from '@typeservice/process';
import { logger } from './logger';

export const RADOX_PORT_CONTEXT = createContext<number>();
export const RADOX_APPLICATION_CONTEXT = createContext<Radox>();

export interface TCreateRadoxServerProps {
  readonly zookeeper: string,
  readonly services?: interfaces.Newable<unknown>[],
}

export function createRadoxServer(props: TCreateRadoxServerProps) {
  return async () => {
    const port = await checkPort(pickFreePort(10000, 20000));
    const radox = new Radox({
      port, container, logger,
      zookeeper: props.zookeeper,
    })

    if (props.services && props.services.length) {
      props.services.forEach(service => radox.define(service));
    }

    await radox.listen();

    RADOX_PORT_CONTEXT.setContext(port);
    RADOX_APPLICATION_CONTEXT.setContext(radox);

    return () => radox.close();
  }
}