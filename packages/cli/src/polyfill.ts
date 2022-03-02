import Registry from './registry';

const NPM = require('npm/lib/npm');
const Commands = require('npm/lib/utils/cmd-list')

export default function(command: string, rawArgs: string[] = []) {
  if (Commands.cmdList.includes(command)) {
    const npm = new NPM();
    const registry = new Registry();
  
    if (registry.configs.registry) {
      rawArgs.push('--registry=' + registry.configs.registry);
      rawArgs.push('--disturl=https://cdn.npmmirror.com/binaries/node');
    }
    
    return npm.exec(command, rawArgs);
  }
}