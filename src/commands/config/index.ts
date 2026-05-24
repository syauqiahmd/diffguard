import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { requireInit } from '../../core/init-guard.js';
import { globalConfigPath } from '../../core/paths.js';
import { printSuccess, printError } from '../../core/formatter/terminal.js';
import type { SuppressRule } from '../../types/index.js';

interface AddSuppressOptions {
  contains?: string;
  file?: string;
  tag?: string;
  line?: string;
}

export function addSuppressRuleToConfig(rule: SuppressRule): void {
  const configPath = globalConfigPath();
  if (!existsSync(configPath)) {
    throw new Error(`Config not found at ${configPath}. Run diffguard init first.`);
  }

  const content = readFileSync(configPath, 'utf-8');

  // Build the YAML rule line(s)
  const fields: string[] = [];
  if (rule.contains) fields.push(`contains: "${rule.contains}"`);
  if (rule.file) fields.push(`file: "${rule.file}"`);
  if (rule.tag) fields.push(`tag: "${rule.tag}"`);
  if (rule.line !== undefined) fields.push(`line: ${rule.line}`);

  if (fields.length === 0) {
    throw new Error('At least one of --contains, --file, --tag must be specified.');
  }

  // Single-field rules stay on one line; multi-field rules use indented block style
  const ruleYaml =
    fields.length === 1
      ? `  - ${fields[0]}`
      : `  - ${fields[0]}\n    ${fields.slice(1).join('\n    ')}`;

  const lines = content.split('\n');
  const suppressIdx = lines.findIndex((l) => l.trim() === 'suppress:');

  if (suppressIdx !== -1) {
    // Find end of suppress section (next top-level key that isn't empty/comment)
    let insertIdx = suppressIdx + 1;
    while (insertIdx < lines.length) {
      const line = lines[insertIdx] ?? '';
      if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && !line.startsWith('#')) {
        break;
      }
      insertIdx++;
    }
    lines.splice(insertIdx, 0, ruleYaml);
    writeFileSync(configPath, lines.join('\n'), 'utf-8');
  } else {
    // No suppress section — append at end
    const newContent = content.trimEnd() + '\n\nsuppress:\n' + ruleYaml + '\n';
    writeFileSync(configPath, newContent, 'utf-8');
  }
}

const addSuppressCommand = new Command('add-suppress')
  .description('Add a suppress rule to the project config')
  .option('--contains <text>', 'Suppress findings whose note contains this text')
  .option('--file <path>', 'Suppress findings in files whose path contains this substring')
  .option('--tag <tag>', 'Suppress findings with this impact tag (e.g. security, logic)')
  .option('--line <number>', 'Suppress findings at this exact line number')
  .action((options: AddSuppressOptions) => {
    requireInit();
    try {
      const rule: SuppressRule = {};
      if (options.contains) rule.contains = options.contains;
      if (options.file) rule.file = options.file;
      if (options.tag) rule.tag = options.tag;
      if (options.line) rule.line = parseInt(options.line, 10);

      addSuppressRuleToConfig(rule);

      const parts: string[] = [];
      if (rule.contains) parts.push(`contains: "${rule.contains}"`);
      if (rule.file) parts.push(`file: "${rule.file}"`);
      if (rule.tag) parts.push(`tag: "${rule.tag}"`);
      if (rule.line !== undefined) parts.push(`line: ${rule.line}`);

      printSuccess(`Suppress rule added: ${parts.join(', ')}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      printError(message);
      process.exit(1);
    }
  });

export const configCommand = new Command('config')
  .description('Manage DiffGuard project configuration')
  .addCommand(addSuppressCommand);
