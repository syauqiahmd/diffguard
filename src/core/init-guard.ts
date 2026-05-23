import { existsSync } from 'fs';
import { globalConfigPath } from './paths.js';
import chalk from 'chalk';

export function requireInit(): void {
  if (!existsSync(globalConfigPath())) {
    console.error('');
    console.error(chalk.red('  ✗ Project not initialized.'));
    console.error('');
    console.error(chalk.dim('  Run this first in your project directory:'));
    console.error(chalk.bold('    diffguard init'));
    console.error('');
    process.exit(1);
  }
}
