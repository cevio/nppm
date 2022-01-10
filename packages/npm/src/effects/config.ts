import { existsSync } from 'fs';
import { resolve } from 'path';
import { createContext } from '@typeservice/process';
import { Exception } from '@typeservice/exception';
import { TSchema } from '../interface';
import { ensureDirSync } from 'fs-extra';

export interface TConfigs {
  dev?: boolean,
  port?: number,
  zookeeper: string,
  dictionary: string,
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
  console.log(schema, process.argv)
  const cwd = process.cwd();
  const filename = resolve(cwd, schema.config || 'npm.config.json');
  if (!existsSync(filename)) throw new Exception(8004, 'Can not find `npm.config.json` file', filename);
  const configs = require(filename) as TConfigs;
  ConfigContext.setContext(configs);
  const dicionary = resolve(cwd, configs.dictionary || 'node_packages');
  ensureDirSync(dicionary);
  configs.dictionary = dicionary;
}