#!/usr/bin/env node

import { program } from 'commander';
import Registry from './registry';
import Polyfill from './polyfill';

const { version } = require('../package.json');

program
  .allowUnknownOption(true)
  .option('-v, --version', 'NPC version')
  .version(version);

program.command('registry')
  .description('Manage registry operations')
  .option('-t, --type [mode]', 'query delete edit registries.', 'q')
  .action(Registry.main);

program.command('*')
  .allowUnknownOption(true)
  .action(Polyfill);

program.parseAsync(process.argv);