#!/usr/bin/env node
import { program } from 'commander';
import { reviewCommand } from './commands/review/index.js';
import { initCommand } from './commands/init/index.js';
import { usageCommand } from './commands/usage/index.js';

program
  .name('diffguard')
  .description('Local-first AI engineering assistant for backend teams')
  .version('0.1.0');

program.addCommand(reviewCommand);
program.addCommand(initCommand);
program.addCommand(usageCommand);

program.parse();
