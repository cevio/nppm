import { ParsedArgs } from 'minimist';
export interface TSchema extends ParsedArgs {
  port: string,
  config: string,
  dev?: boolean,
}