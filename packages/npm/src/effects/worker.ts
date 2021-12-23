import { createContext, Worker } from '@nppm/process';
import { logger } from '../util';
import { Port } from '@nppm/toolkit';
import { ConfigContext } from './config';
import { HttpService, UserService } from '../service';

export const WSPORT_CONTEXT = createContext<number>();
export async function createWorker() {
  if (!ConfigContext.value.zookeeper) return;
  const port = await Port.check(Port.range(10000, 20000));
  WSPORT_CONTEXT.setContext(port);
  return Worker({
    port: port,
    zookeeper: ConfigContext.value.zookeeper,
    logger,
    services: [HttpService, UserService]
  })
}