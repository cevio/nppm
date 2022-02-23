import { TORMConfigs, TCreateRedisServerProps } from '@nppm/utils';
import { NPMCore } from '.';
export interface TConfigs {
  orm: TORMConfigs,
  redis: TCreateRedisServerProps,
}

export type TApplication = (core: NPMCore) => void | TApplicationRollback | Promise<void> | Promise<TApplicationRollback>;
export type TApplicationRollback = void | (() => any | Promise<any>);


export interface TApplicationPackageJSONState {
  name: string,
  version: string,
  description: string,
  plugin_name: string,
  plugin_icon: string,
  main: string,
  devmain: string,
  nppm: true,
  _uninstall?: TApplicationRollback,
  plugin_configs?: TPluginConfigs[],
}

export type TPluginConfigs<T = any> = TPluginConfigInput<T> | TPluginConfigSelect<T> | TPluginConfigRadio<T> | TPluginConfigSwitch | TPluginConfigCheckbox<T>;

export interface TPluginConfigBase<T = any> {
  key: string,
  value: T,
  title: string,
}

export interface TLabelValue<T = any> {
  label: string,
  value: T
}

export interface TPluginConfigInput<T> extends TPluginConfigBase<T> {
  type: 'input',
  placeholder?: string,
  mode?: string,
  width?: number | string,
}

export interface TPluginConfigSelect<T> extends TPluginConfigBase<T> {
  type: 'select',
  placeholder?: string,
  fields: TLabelValue<T>[],
  width?: number | string,
}

export interface TPluginConfigRadio<T> extends TPluginConfigBase<T> {
  type: 'radio',
  fields: TLabelValue<T>[],
}

export interface TPluginConfigSwitch extends TPluginConfigBase<boolean> {
  type: 'switch',
  placeholder?: [string, string],
}

export interface TPluginConfigCheckbox<T> extends TPluginConfigBase<T[]> {
  type: 'checkbox',
  fields: TLabelValue<T>[],
  span?: number,
  gutter?: number | [number, number],
}