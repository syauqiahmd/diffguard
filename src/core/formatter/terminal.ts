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

interface BranchSummary {
  currentBranch: string;
  targetBranch: string;
  filesChanged: number;
  commitsBehind: number;
}

export function printCostSummary(
  response: AIResponse,
  confidence: number | null = null,
  branch?: BranchSummary
): void {
  console.log('');
  console.log(chalk.dim('─'.repeat(40)));
  if (branch) {
    const behind = branch.commitsBehind > 0
      ? chalk.yellow(` · ${branch.commitsBehind} behind`)
      : '';
    console.log(
      `  ${chalk.cyan(branch.currentBranch)} ${chalk.dim('→')} ${chalk.dim('origin/')}${chalk.white(branch.targetBranch)}` +
      `  ${chalk.dim(`${branch.filesChanged} file${branch.filesChanged === 1 ? '' : 's'}`)}${behind}`
    );
    console.log(chalk.dim('─'.repeat(40)));
  }
  console.log(chalk.dim(`  Provider: ${response.provider} / ${response.model}`));
  if (confidence !== null) {
    const color = confidence >= 80 ? chalk.green : confidence >= 60 ? chalk.yellow : chalk.red;
    console.log(`  Confidence:    ${color.bold(`${confidence}%`)}`);
  }
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

const TAG_COLORS: Record<string, (s: string) => string> = {
  'api-break': chalk.yellow,
  'data-loss': chalk.red,
  'security':  chalk.red,
  'async-bug': chalk.magenta,
  'perf':      chalk.yellow,
  'logic':     chalk.cyan,
};

function colorTag(note: string): string {
  return note.replace(/\[([^\]]+)\]/, (_, tag: string) => {
    const color = TAG_COLORS[tag.toLowerCase()] ?? chalk.dim;
    return color(`[${tag}]`);
  });
}

function capFix(snippet: string, max = 60): string {
  return snippet.length > max ? snippet.slice(0, max - 3) + '...' : snippet;
}

export function printCommentReview(content: string, suppressedCount = 0): void {
  console.log('');
  let droppedLines = 0;
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[-*•]\s+/, '');
    if (!trimmed) continue;
    if (trimmed.startsWith('Summary:')) {
      console.log('');
      console.log(chalk.bold.white(trimmed));
    } else if (trimmed.startsWith('fix:')) {
      const snippet = capFix(trimmed.slice(4).trim());
      console.log(`    ${chalk.dim('fix:')} ${chalk.green(snippet)}`);
    } else if (trimmed.includes(' -> ')) {
      const arrowIdx = trimmed.indexOf(' -> ');
      const loc = trimmed.slice(0, arrowIdx);
      const note = colorTag(trimmed.slice(arrowIdx + 4));
      const locFormatted = loc.replace(/:(\d+)$/, (_, n) => chalk.dim(':') + chalk.yellow(n));
      console.log(`  ${chalk.cyan(locFormatted)} ${chalk.dim('->')} ${note}`);
    } else {
      droppedLines++;
    }
  }

  const notes: string[] = [];
  if (droppedLines > 0) notes.push(`${droppedLines} unstructured line${droppedLines === 1 ? '' : 's'} filtered`);
  if (suppressedCount > 0) notes.push(`${suppressedCount} finding${suppressedCount === 1 ? '' : 's'} suppressed`);
  if (notes.length > 0) {
    process.stdout.write(chalk.dim(`  (${notes.join(' · ')})\n`));
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
