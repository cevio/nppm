import { resolve } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { HttpServiceUnavailableException } from '@typeservice/exception';
import { createDefaultORMState, createDefaultRedisState, TORMConfigs, setORMState, TCreateRedisServerProps, setRedisState } from '@nppm/utils';

const pkg = require('../package.json');

export class Configs {
  public readonly configFilename: string;
  public value = this.createDefaultConfigState();
  constructor(home: string) {
    this.configFilename = resolve(home, 'package.json');
  }

  public saveFile() {
    writeFileSync(this.configFilename, JSON.stringify(this.value, null, 2), 'utf8');
  }

  private createDefaultConfigState() {
    return {
      name: 'nppm',
      version: pkg.version as string,
      description: pkg.description as string,
      orm: createDefaultORMState(),
      redis: createDefaultRedisState(),
      dependencies: {} as Record<string, string>,
    }
  }

  public createConfigServer() {
    return () => {
      if (!existsSync(this.configFilename)) {
        this.saveFile();
      } else {
        const value = require(this.configFilename);
        if (value.name !== this.value.name) {
          throw new HttpServiceUnavailableException('package name is not accept');
        }
        this.value = value;
      }
    }
  }

  public updateORMState(state: TORMConfigs) {
    this.value.orm = state;
    this.saveFile();
    setORMState(state);
    return () => {
      const value = createDefaultORMState();
      this.value.orm = value;
      this.saveFile()
      setORMState(value);
    }
  }

  public updateRedisState(state: TCreateRedisServerProps) {
    this.value.redis = state;
    this.saveFile();
    setRedisState(state);
    return () => {
      const value = createDefaultRedisState();
      this.value.redis = value;
      this.saveFile();
      setRedisState(value);
    }
  }
}