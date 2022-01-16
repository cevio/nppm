import { TORMConfigs, TCreateRedisServerProps } from '@nppm/utils';
import { NPMCore } from '.';
export interface TConfigs {
  orm: TORMConfigs,
  redis: TCreateRedisServerProps,
}

export type TApplication = (core: NPMCore, name: string) => void | TApplicationRollback | Promise<void> | Promise<TApplicationRollback>;
export type TApplicationRollback = void | (() => any | Promise<any>);


export interface TApplicationPackageJSONState {
  name: string,
  version: string,
  description: string,
  main: string,
  devmain: string,
  nppm: true,
  _uninstall?: TApplicationRollback
}