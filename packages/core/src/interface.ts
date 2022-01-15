import { ParsedArgs } from 'minimist';
import { TORMConfigs, TCreateRedisServerProps } from '@nppm/utils';
import { NPMCore } from '.';
export interface TSchema extends ParsedArgs {
  port: string,
}

export interface TConfigs {
  orm: TORMConfigs,
  redis: TCreateRedisServerProps,
}

export type TApplication = (core: NPMCore) => Promise<() => Promise<any>>;

export interface TApplicationPackageJSONState {
  name: string,
  version: string,
  description: string,
  main: string,
  devmain: string,
  nppm: true,
  _uninstall?: () => Promise<any>
}