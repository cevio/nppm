import { ParsedArgs } from 'minimist';
import { TORMConfigs, TCreateRedisServerProps } from '@nppm/utils';
export interface TSchema extends ParsedArgs {
  port: string,
  zookeeper: string,
}

export interface TConfigs {
  orm: TORMConfigs,
  redis: TCreateRedisServerProps,
}