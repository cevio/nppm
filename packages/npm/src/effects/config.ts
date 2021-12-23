import { existsSync } from 'fs';
import { resolve } from 'path';
import { createContext } from '@nppm/process';
import { Exception } from '@nppm/toolkit';
import { TSchema } from '../interface';

export interface TConfigs {
  dev?: boolean,
  port?: number,
  zookeeper: string,
  orm: {
    type: string,
    host: string,
    port: number,
    username: string,
    password: string,
    database: string,
  },
  redis: {
    host: string,
    port: number,
    password?: string,
    db?: number
  }
}

export const ConfigContext = createContext<TConfigs>();
export function createConfigs(schema: TSchema) {
  const cwd = process.cwd();
  const filename = resolve(cwd, schema.config || 'npm.config.json');
  if (!existsSync(filename)) throw new Exception(8004, 'Can not find `npm.config.json` file');
  const configs = require(filename) as TConfigs;
  ConfigContext.setContext(configs);
}