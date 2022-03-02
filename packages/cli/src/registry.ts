import axios from 'axios';
import { resolve, dirname } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { info, error, warn } from 'npmlog';
import { parse, resolve as resolveURL } from 'url';
import { prompt } from 'inquirer';

const NPPMPackage = require('../package.json');

export default class Registry {
  private readonly filename = 'nppm.config.json';
  private readonly filepath: string;
  private readonly httpRegexp = /^(ht|f)tp(s?)\:\/\/[0-9a-zA-Z]([-.\w]*[0-9a-zA-Z])*(:(0-9)*)*(\/?)([a-zA-Z0-9\-\.\?\,\'\/\\\+&amp;%$#_]*)?$/;
  public  readonly configs: ReturnType<Registry['createDefaultConfigs']>;
  private readonly heading = 'registry';
  /**
   * registry 管理入口
   * npc r -t=?
   * @param options 
   * @property options.q 查询当前使用的registry
   * @property options.d 删除registry
   * @property options.a 新增registry
   * @property options.c 切换registry
   * @returns 
   */
  static main(options: { type: 'q' | 'd' | 'a' | 'c' }) {
    const main = new Registry();
    switch (options.type) {
      case 'd': return main.delete();
      case 'a': return main.add();
      case 'c': return main.change();
      default: return main.query();
    }
  }

  constructor() {
    this.filepath = resolve(process.env.HOME, this.filename);
    if (!existsSync(this.filepath)) {
      this.configs = this.createDefaultConfigs();
      this.save();
    } else {
      this.configs = require(this.filepath);
    }
  }

  public query() {
    if (!this.configs.registry) {
      return warn(this.heading, 'no registries, please use `npc r -t=a` to create a registry.');
    }
    info(this.heading, this.configs.registry);
  }

  public async delete() {
    if (!this.configs.registries.length) {
      return warn(this.heading, 'no registries, please use `npc r -t=a` to create a registry.');
    }
    const questions = [
      {
        type: 'list',
        name: 'selected',
        message: 'Which reigstry do you want to delete?',
        default: this.configs.registry,
        choices: this.configs.registries,
      }
    ]
    const { selected } = await prompt<{ selected: string }>(questions);
    const index = this.configs.registries.indexOf(selected);
    if (index === -1) return error(this.heading, 'The registry is not exists.');
    this.configs.registries.splice(index, 1);
    if (this.configs.registry === selected) {
      this.configs.registry = this.configs.registries[0];
    }
    info(this.heading, '- %s', selected);
  }

  public async add() {
    const questions = [
      {
        type: 'input',
        name: 'value',
        message: 'What is the url of new registry?',
        validate: (value: string) => {
          if (!value) return 'New registry cannot be empty.';
          if (!this.httpRegexp.test(value)) return 'Incorrect URL address format.';
          const hostPaths = this.configs.registries.map(host => parse(host).hostname);
          const pathname = parse(value).hostname;
          if (hostPaths.includes(pathname)) return 'Registry address already exists';
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'use',
        message: 'Use this registry?',
        default: true,
      }
    ];
    const { value, use } = await prompt<{ value: string, use: boolean }>(questions);
    if (this.configs.registries.includes(value)) {
      return error(this.heading, 'The registry of `' + value + '` has already exists.');
    }
    const npmDictionary = dirname(require.resolve('npm'));
    const text = readFileSync(npmDictionary, 'utf8');
    const { version } = JSON.parse(text);
    const { data: pkg } = await axios.get(resolveURL(value, '/npm'), {
      headers: {
        'user-agent': 'npm/' + version + ' nppm/cli/' + NPPMPackage.version,
      }
    })
    if (pkg.name !== 'npm' || !pkg._rev || !pkg.versions || !pkg['dist-tags'] || !!pkg.error) {
      return error('registry', 'Invalid registry! It is not a private npm registry.');
    }
    this.configs.registries.push(value);
    if (use) this.configs.registry = value;
    this.save();
    info(this.heading, '+ %s', value);
  }

  public async change() {
    if (!this.configs.registries.length) {
      return warn(this.heading, 'no registries, please use `npc r -t=a` to create a registry.');
    }
    const questions = [
      {
        type: 'list',
        name: 'selected',
        message: 'Which reigstry do you want to use?',
        default: this.configs.registry || this.configs.registries[0],
        choices: this.configs.registries,
      }
    ]
    const { selected } = await prompt<{ selected: string }>(questions);
    this.configs.registry = selected;
    this.save();
    info(this.heading, '+ %s', selected);
  }

  private save() {
    if (this.configs) {
      writeFileSync(this.filepath, JSON.stringify(this.configs, null, 2), 'utf8');
    }
  }

  private createDefaultConfigs() {
    return {
      registry: null as string,
      registries: [] as string[],
    }
  }
}