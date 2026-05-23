import { Command } from 'commander';
import { writeFileSync } from 'fs';
import ora from 'ora';
import { loadConfig } from '../../core/config/loader.js';
import { fetchRemoteBranch, analyzeGit, detectDefaultBranch } from '../../core/git/analyzer.js';
import { getProvider, selectModel } from '../../core/ai/router.js';
import { recordUsage } from '../../core/budget/tracker.js';
import {
  printHeader,
  printSuccess,
  printError,
  printCostSummary,
  printReview,
} from '../../core/formatter/terminal.js';
import type { AIResponse } from '../../types/index.js';

interface PrOptions {
  target?: string;
  branch?: string;
  output?: string;
}

function buildSystemPrompt(): string {
  return `You are a technical writer generating a pull request description.

Output exactly this structure — no other text before or after:

## Title
<imperative mood, under 72 characters>

## Summary
- bullet
- bullet

## Why
one sentence explaining the motivation

## Test plan
- [ ] item
- [ ] item

Rules:
- Title must be imperative mood (e.g. "Add", "Fix", "Remove", "Update") — never passive, never "This PR"
- Summary bullets describe what changed, not why
- Why is one sentence max — the business or technical reason
- Test plan items are concrete, checkable steps
- No filler text, no "this PR", no "I", no passive voice
- Do not output any text outside the four sections above`;
}

function buildUserPrompt(
  currentBranch: string,
  targetBranch: string,
  changedFiles: import('../../types/index.js').ChangedFile[]
): string {
  const parts: string[] = [];

  parts.push('## PR Request');
  parts.push(`- **Current branch**: \`${currentBranch}\``);
  parts.push(`- **Target branch**: \`origin/${targetBranch}\``);
  parts.push(`- **Files changed**: ${changedFiles.length}`);
  parts.push('');

  parts.push('## Changed Files');
  for (const file of changedFiles) {
    parts.push(`### \`${file.path}\` (${file.status})`);
    parts.push('```diff');
    const maxDiffChars = 8000;
    const diff =
      file.diff.length > maxDiffChars
        ? file.diff.slice(0, maxDiffChars) + '\n... [diff truncated for brevity]'
        : file.diff;
    parts.push(diff);
    parts.push('```');
    parts.push('');
  }

  parts.push('Generate a pull request description for the changes above.');

  return parts.join('\n');
}

async function runPr(options: PrOptions): Promise<void> {
  const config = loadConfig();

  const target = options.target ?? (await detectDefaultBranch());

  printHeader('DiffGuard PR Description');

  // Step 1: Fetch remote
  const fetchSpinner = ora('Fetching remote branch...').start();
  try {
    await fetchRemoteBranch(target, options.branch);
    fetchSpinner.succeed(`Fetched origin/${target}`);
  } catch (err) {
    fetchSpinner.fail('Failed to fetch remote branch');
    const message = err instanceof Error ? err.message : String(err);
    printError(message);
    process.exit(1);
  }

  // Step 2: Analyze git diff
  const analyzeSpinner = ora('Analyzing git diff...').start();
  let gitAnalysis: Awaited<ReturnType<typeof analyzeGit>>;
  try {
    gitAnalysis = await analyzeGit(target, options.branch);
    analyzeSpinner.succeed('Analysis complete');
  } catch (err) {
    analyzeSpinner.fail('Git analysis failed');
    const message = err instanceof Error ? err.message : String(err);
    printError(message);
    process.exit(1);
  }

  if (gitAnalysis.changedFiles.length === 0) {
    printError('No changed files detected — nothing to describe.');
    process.exit(1);
  }

  // Step 3: Call AI
  const model = selectModel('balanced', 'review', config.review.model);
  const aiSpinner = ora(`Generating PR description (${model})...`).start();

  let aiResponse: AIResponse;
  try {
    const provider = getProvider(config);
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(
      gitAnalysis.currentBranch,
      target,
      gitAnalysis.changedFiles
    );
    aiResponse = await provider.complete(userPrompt, systemPrompt, model);
    aiSpinner.succeed('PR description generated');
  } catch (err) {
    aiSpinner.fail('AI call failed');
    const message = err instanceof Error ? err.message : String(err);
    printError(`AI error: ${message}`);
    if (message.includes('ANTHROPIC_API_KEY')) {
      printError('Set ANTHROPIC_API_KEY in your .env file to enable AI features.');
    }
    process.exit(1);
  }

  // Step 4: Output
  if (options.output) {
    writeFileSync(options.output, aiResponse.content + '\n', 'utf-8');
    printSuccess(`PR description written to ${options.output}`);
  } else {
    printReview(aiResponse.content);
  }

  printCostSummary(aiResponse);

  // Step 5: Record usage
  await recordUsage({
    date: new Date().toISOString(),
    branch: gitAnalysis.currentBranch,
    provider: aiResponse.provider,
    model: aiResponse.model,
    inputTokens: aiResponse.inputTokens,
    outputTokens: aiResponse.outputTokens,
    cost: aiResponse.cost,
  });
}

export const prCommand = new Command('pr')
  .description('Generate a PR description for changes against a target branch')
  .option('-t, --target <branch>', 'Target branch to compare against (default: auto-detect main/master)')
  .option('-b, --branch <branch>', 'Source branch to review (default: current local branch)')
  .option('--output <file>', 'Save PR description to file')
  .action(async (options: PrOptions) => {
    try {
      await runPr(options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      printError(`Unexpected error: ${message}`);
      process.exit(1);
    }
  });
