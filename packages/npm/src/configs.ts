import { resolve } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { TConfigs } from './interface';
import { createContext } from '@typeservice/process';
import { createDefaultORMState, createDefaultRedisState, setORMState, setRedisState, TORMConfigs, TCreateRedisServerProps } from '@nppm/utils';
const CONFIG_FILENAME = 'nppm-configs.json';
export const CONFIGS = createContext(createDefaultConfigState());
export function createConfigServer() {
  const configFile = resolve(process.env.HOME, CONFIG_FILENAME);
  if (!existsSync(configFile)) {
    writeFileSync(configFile, JSON.stringify(CONFIGS.value), 'utf8');
  } else {
    const state = require(configFile) as TConfigs;
    CONFIGS.setContext(state);
  }
}

export function createDefaultConfigState(): TConfigs {
  return {
    orm: createDefaultORMState(),
    redis: createDefaultRedisState(),
  }
}

export function updateORMState(state: TORMConfigs) {
  const configFile = resolve(process.env.HOME, CONFIG_FILENAME);
  setORMState(state);
  CONFIGS.value.orm = state;
  writeFileSync(configFile, JSON.stringify(CONFIGS.value), 'utf8');
}

export function updateRedisState(state: TCreateRedisServerProps) {
  const configFile = resolve(process.env.HOME, CONFIG_FILENAME);
  setRedisState(state);
  CONFIGS.value.redis = state;
  writeFileSync(configFile, JSON.stringify(CONFIGS.value), 'utf8');
}