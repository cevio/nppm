import Registry from './registry';
import { join } from 'path';
import { spawn } from 'child_process';
import { error } from 'npmlog';

const cwd = process.cwd();
const npmBin = join(__dirname, '..', 'node_modules', '.bin', 'npm');
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
      const childprocess = spawn(npmBin, argvs, { env, cwd, stdio: 'inherit' });
      childprocess.on('exit', code => {
        if (code === 0) return resolve();
        return reject(new Error(`\`npm ${argvs.join(' ')}\` exit with code ${code}`));
      })
    }).catch(e => error('registry', e.message));
  }
}