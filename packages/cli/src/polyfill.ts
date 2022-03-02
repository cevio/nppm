import Registry from './registry';
import { join } from 'path';
import { spawn } from 'child_process';
import { warn } from 'npmlog';

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

export default function(command: string, rawArgs: string[] = []) {
  warn('registry', 'execute', command, ...rawArgs);
  if (commands.includes(command)) {
    const registry = new Registry();
    const env = Object.assign({}, process.env);
    const stdio = [
      process.stdin,
      process.stdout,
      process.stderr,
    ];
  
    if (registry.configs.registry) {
      rawArgs.push('--registry=' + registry.configs.registry);
      rawArgs.push('--disturl=https://cdn.npmmirror.com/binaries/node');
    }
    
    return new Promise<void>((resolve, reject) => {
      const childprocess = spawn(npmBin, rawArgs, { env, cwd, stdio });
      childprocess.on('exit', code => {
        if (code == 0) return resolve();
        return reject(new Error(`\`npm ${rawArgs.join(' ')}\` exit with code ${code}`));
      })
    });
  }
}