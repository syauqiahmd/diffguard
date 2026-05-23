import chalk from 'chalk';
import type { AIResponse, ReviewContext, RuleViolation } from '../../types/index.js';
import { formatCost, formatTokens } from '../tokenizer/estimator.js';

export function printHeader(title: string): void {
  const line = '─'.repeat(60);
  console.log('');
  console.log(chalk.bold.cyan(line));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan(line));
  console.log('');
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function printWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

export function printError(message: string): void {
  console.log(chalk.red(`✗ ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}

export function printViolations(violations: RuleViolation[]): void {
  if (violations.length === 0) {
    printSuccess('No rule violations found');
    return;
  }

  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warning');

  if (errors.length > 0) {
    console.log(chalk.red.bold(`\n  Errors (${errors.length}):`));
    for (const v of errors) {
      const location = v.line ? `:${v.line}` : '';
      console.log(chalk.red(`  ✗ [${v.rule}] ${v.file}${location}`));
      console.log(chalk.red(`    ${v.message}`));
    }
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow.bold(`\n  Warnings (${warnings.length}):`));
    for (const v of warnings) {
      const location = v.line ? `:${v.line}` : '';
      console.log(chalk.yellow(`  ⚠ [${v.rule}] ${v.file}${location}`));
      console.log(chalk.yellow(`    ${v.message}`));
    }
  }
}

export function printContextSummary(context: ReviewContext): void {
  console.log('');
  console.log(chalk.bold('  Context Summary:'));
  console.log(
    chalk.dim(`  Changed files:   ${context.changedFiles.length}`)
  );
  console.log(
    chalk.dim(`  Related files:   ${context.relatedFiles.length}`)
  );
  console.log(
    chalk.dim(`  Rule violations: ${context.ruleViolations.length}`)
  );
  console.log(
    chalk.dim(`  Est. tokens:     ${formatTokens(context.totalTokens)}`)
  );
  console.log(
    chalk.dim(`  Est. cost:       ${formatCost(context.estimatedCost)}`)
  );
  console.log('');
}

export function printCostSummary(response: AIResponse): void {
  console.log('');
  console.log(chalk.dim('─'.repeat(40)));
  console.log(chalk.dim(`  Provider: ${response.provider} / ${response.model}`));
  console.log(chalk.dim(`  Input tokens:  ${formatTokens(response.inputTokens)}`));
  console.log(chalk.dim(`  Output tokens: ${formatTokens(response.outputTokens)}`));
  console.log(chalk.bold.dim(`  Actual cost:   ${formatCost(response.cost)}`));
  console.log(chalk.dim('─'.repeat(40)));
}

export function printReview(content: string): void {
  console.log('');
  console.log(chalk.bold.white('Review'));
  console.log(chalk.dim('─'.repeat(50)));

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,3}\s/.test(line) || /^[A-Z]{2,}$/.test(trimmed)) {
      console.log('');
      console.log(chalk.bold.cyan(trimmed.replace(/^#+\s*/, '')));
    } else if (trimmed.startsWith('fix:')) {
      const snippet = trimmed.slice(4).trim();
      console.log(`      ${chalk.dim('fix:')} ${chalk.green(snippet)}`);
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      console.log(chalk.white('  ' + trimmed));
    } else if (/^\d+\./.test(trimmed)) {
      console.log(chalk.white('  ' + trimmed));
    } else if (trimmed.startsWith('Summary:')) {
      console.log('');
      console.log(chalk.bold.white(trimmed));
    } else {
      console.log(chalk.dim('  ' + trimmed));
    }
  }

  console.log('');
}

export function printCommentReview(content: string): void {
  console.log('');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[-*•]\s+/, '');
    if (!trimmed) continue;
    if (trimmed.startsWith('Summary:')) {
      console.log('');
      console.log(chalk.bold.white(trimmed));
    } else if (trimmed.startsWith('fix:')) {
      const snippet = trimmed.slice(4).trim();
      console.log(`    ${chalk.dim('fix:')} ${chalk.green(snippet)}`);
    } else if (trimmed.includes(' -> ')) {
      const arrowIdx = trimmed.indexOf(' -> ');
      const loc = trimmed.slice(0, arrowIdx);
      const note = trimmed.slice(arrowIdx + 4);
      const locFormatted = loc.replace(/:(\d+)$/, (_, n) => chalk.dim(':') + chalk.yellow(n));
      console.log(`  ${chalk.cyan(locFormatted)} ${chalk.dim('->')} ${chalk.white(note)}`);
    } else {
      console.log(chalk.dim('  ' + trimmed));
    }
  }
  console.log('');
}

export function printBranchInfo(
  currentBranch: string,
  targetBranch: string,
  filesChanged: number,
  commitsBehind: number
): void {
  console.log(chalk.bold('  Branch Info:'));
  console.log(chalk.dim(`  Current branch:  ${currentBranch}`));
  console.log(chalk.dim(`  Target branch:   origin/${targetBranch}`));
  console.log(chalk.dim(`  Files changed:   ${filesChanged}`));
  if (commitsBehind > 0) {
    console.log(chalk.yellow(`  Commits behind:  ${commitsBehind}`));
  } else {
    console.log(chalk.dim(`  Commits behind:  0`));
  }
  console.log('');
}
