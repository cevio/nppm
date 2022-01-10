import { Port } from '../util';
import { ConfigContext } from './config';
import { Services } from '../service';
import { Radox } from '@typeservice/radox';
import { container } from '../container';
import { createContext } from '@typeservice/process';

export const WSPORT_CONTEXT = createContext<number>();
export const RadoxContext = createContext<Radox>();
export async function createWorker() {
  if (!ConfigContext.value.zookeeper) return;
  const port = await Port.check(Port.range(10000, 20000));
  WSPORT_CONTEXT.setContext(port);
  const radox = new Radox({
    port, container,
    zookeeper: ConfigContext.value.zookeeper,
  })
  RadoxContext.setContext(radox);
  Services.forEach(service => radox.define(service));
  await radox.listen();
  return () => radox.close();
}