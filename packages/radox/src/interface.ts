import { interfaces } from "inversify";
import { Logger } from 'log4js';

export interface RadoxProps {
  zookeeper: string,
  port: number,
  balance?: 'rdm' | 'hit',
  logger: Logger
}

export interface TNameSpace {
  target: interfaces.Newable<any>, 
  methods: string[], 
  path: string,
}

export interface TSendProps {
  command: string,
  method: string,
  arguments: any[],
  balance?: RadoxProps['balance'],
  timeout?: number,
}