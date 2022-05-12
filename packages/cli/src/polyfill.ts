import Registry from './registry';
import { spawn } from 'child_process';
import { error, info } from 'npmlog';
import commandExists from 'command-exists';

const chalk = require('chalk');
const cwd = process.cwd();
const commands = [
  'ci',
  'install-ci-test',
  'install',
  'install-test',
  'uninstall',
  'cache',
  'config',
  'set',
  'get',
  'update',
  'outdated',
  'prune',
  'pack',
  'find-dupes',
  'dedupe',
  'hook',

  'rebuild',
  'link',

  'publish',
  'star',
  'stars',
  'unstar',
  'adduser',
  'login', // This is an alias for `adduser` but it can be confusing
  'logout',
  'unpublish',
  'owner',
  'access',
  'team',
  'deprecate',
  'shrinkwrap',
  'token',
  'profile',
  'audit',
  'fund',
  'org',

  'help',
  'ls',
  'll',
  'search',
  'view',
  'init',
  'version',
  'edit',
  'explore',
  'docs',
  'repo',
  'bugs',
  'root',
  'prefix',
  'bin',
  'whoami',
  'diff',
  'dist-tag',
  'ping',
  'pkg',

  'test',
  'stop',
  'start',
  'restart',
  'run-script',
  'set-script',
  'completion',
  'doctor',
  'exec',
  'explain',

  'un',
  'rb',
  'list',
  'ln',
  'create',
  'i',
  'it',
  'cit',
  'up',
  'c',
  's',
  'se',
  'tst',
  't',
  'ddp',
  'v',
  'run',
  'clean-install',
  'clean-install-test',
  'x',
  'why',
  'exec',
  'run-script',
  'test',
  'start',
  'stop',
  'restart',
  'birthday',
]

export default function(e: any, options: { args: string[] }) {
  const command = options.args[0];
  const rawArgs = options.args.slice(1);
  if (commands.includes(command)) {
    const registry = new Registry();
    const env = process.env;
  
    if (registry.configs.registry) {
      rawArgs.push('--registry=' + registry.configs.registry);
      rawArgs.push('--disturl=https://cdn.npmmirror.com/binaries/node');
    }
    
    const argvs = [command].concat(rawArgs);

    return new Promise<void>((resolve, reject) => {
      const pnpmIndex = options.args.indexOf('--pnpm');
      let bin = 'npm';
      if (pnpmIndex > -1 && commandExists.sync('pnpm')) {
        bin = 'pnpm';
        options.args.splice(pnpmIndex, 1);
        const index = argvs.indexOf('--pnpm');
        if (index > -1) {
          argvs.splice(index, 1);
        }
      }
      info('registry:' + registry.configs.registry, chalk.gray(bin), chalk.gray(...options.args));
      const childprocess = spawn(bin, argvs, { env, cwd, stdio: 'inherit' });
      childprocess.on('exit', code => {
        if (code === 0) return resolve();
        return reject(new Error(`\`npm ${argvs.join(' ')}\` exit with code ${code}`));
      })
    }).catch(e => error('registry', e.message));
  }
}