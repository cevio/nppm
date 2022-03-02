import Registry from './registry';
import { commands } from 'npm';

const NPM = require('npm/lib/npm');

export default function(command: string, rawArgs: string[] = []) {
  if (Object.keys(commands).includes(command)) {
    const npm = new NPM();
    const registry = new Registry();
  
    if (registry.configs.registry) {
      rawArgs.push('--registry=' + registry.configs.registry);
      rawArgs.push('--disturl=https://cdn.npmmirror.com/binaries/node');
    }
    
    return npm.exec(command, rawArgs);
  }
}