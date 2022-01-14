import { resolve } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { TConfigs } from './interface';
import { createContext } from '@typeservice/process';
import { createDefaultORMState, createDefaultRedisState, setORMState, setRedisState, TORMConfigs, TCreateRedisServerProps } from '@nppm/utils';
const CONFIG_FILENAME = 'nppm-configs.json';
const configFile = resolve(process.env.HOME, CONFIG_FILENAME);
export const CONFIGS = createContext(createDefaultConfigState());
export function createConfigServer() {
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
  CONFIGS.value.orm = state;
  writeFileSync(configFile, JSON.stringify(CONFIGS.value), 'utf8');
  setORMState(state);
  return () => {
    const value: TORMConfigs = createDefaultORMState();
    CONFIGS.value.orm = value;
    writeFileSync(configFile, JSON.stringify(CONFIGS.value), 'utf8');
    setORMState(value);
  }
}

export function updateRedisState(state: TCreateRedisServerProps) {
  CONFIGS.value.redis = state;
  writeFileSync(configFile, JSON.stringify(CONFIGS.value), 'utf8');
  setRedisState(state);
  return () => {
    const value: TCreateRedisServerProps = createDefaultRedisState();
    CONFIGS.value.redis = value;
    writeFileSync(configFile, JSON.stringify(CONFIGS.value), 'utf8');
    setRedisState(value);
  }
}