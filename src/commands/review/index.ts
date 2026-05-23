import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../core/config/loader.js';
import { fetchRemoteBranch, analyzeGit, detectDefaultBranch } from '../../core/git/analyzer.js';
import { checkBranchStatus } from '../../core/git/branch-intelligence.js';
import { runAllRules } from '../../core/rules/engine.js';
import { buildContext } from '../../core/context/builder.js';
import { getProvider, selectModel } from '../../core/ai/router.js';
import { compressRelatedFiles } from '../../core/context/compressor.js';
import { getCached, setCached } from '../../core/cache/index.js';
import { recordUsage } from '../../core/budget/tracker.js';
import { writeMarkdownReport, getReportPath } from '../../core/formatter/markdown.js';
import {
  printHeader,
  printSuccess,
  printWarning,
  printError,
  printViolations,
  printContextSummary,
  printCostSummary,
  printReview,
  printCommentReview,
} from '../../core/formatter/terminal.js';
import type { AIResponse } from '../../types/index.js';

interface ReviewOptions {
  target?: string;   // target branch (default: auto-detect main/master)
  branch?: string;   // source branch (default: local HEAD)
  deep: boolean;
  mode?: 'fast' | 'balanced' | 'deep';
  provider?: string;
  output?: 'markdown' | 'json';
  ai: boolean;
  budget?: string;
  noCache: boolean;
}

function buildSystemPrompt(mode: 'comment' | 'standard'): string {
  if (mode === 'comment') {
    return `You are a code reviewer. Output raw comment lines — no bullets, no dashes, no markdown.

How to find line numbers:
- Hunk header: \`@@ -OLD_START,count +NEW_START,count @@\`
- Added lines (+): count from NEW_START. Removed lines (-): count from OLD_START.
- Omit line number only if truly indeterminate.

Impact tags — pick exactly one per comment:
[api-break]  breaks API contract or response shape
[data-loss]  data not persisted, lost, or corrupted
[security]   auth bypass, injection, secret exposure
[async-bug]  missing await, race condition, unhandled rejection
[perf]       unbounded query, N+1, memory risk
[logic]      wrong conditional, off-by-one, bad fallback

Output format per issue (two lines max):
file.ext:line -> [tag] short note (≤7 words)
  fix: short code fix

Rules:
- Every comment line MUST start with file.ext:line -> or file.ext ->
- Only include \`fix:\` when there is a concrete fix. Keep it under 60 chars — trim with ... if needed.
- No prose, no extra explanation lines outside this format
- Always end with Summary then Confidence on separate lines:
  Summary: <one sentence — what changed and verdict>
  Confidence: N% (how certain based on diff clarity and context available)`;
  }

  return `You are an expert backend code reviewer. Be extremely concise.

Output ONLY sections that have findings:

ISSUES
• file:line — short note (≤8 words)
  fix: one-line code fix (only when concrete)

SECURITY
• finding

RECS
1. recommendation (max 3)

Summary: one sentence verdict
Confidence: N%

Rules:
- Omit sections with nothing to say
- Only add \`fix:\` when the fix is short and concrete
- No prose paragraphs, no "None identified"
- Always end with Summary then Confidence (rate based on diff clarity and context available)`;

}

function extractConfidence(content: string): { content: string; confidence: number | null } {
  const match = content.match(/\bConfidence:\s*(\d{1,3})%/i);
  if (!match) return { content, confidence: null };
  const confidence = Math.min(100, Math.max(0, parseInt(match[1]!, 10)));
  const cleaned = content.replace(/\n?Confidence:\s*\d{1,3}%[^\n]*/i, '').trimEnd();
  return { content: cleaned, confidence };
}

function buildUserPrompt(
  context: import('../../types/index.js').ReviewContext,
  targetBranch: string,
  currentBranch: string,
  commitsBehind: number
): string {
  const parts: string[] = [];

  // Branch context
  parts.push(`## Review Request`);
  parts.push(`- **Current branch**: \`${currentBranch}\``);
  parts.push(`- **Merging into**: \`origin/${targetBranch}\``);
  parts.push(`- **Commits behind target**: ${commitsBehind}`);
  parts.push(`- **Files changed**: ${context.changedFiles.length}`);
  parts.push('');

  // Rule violations already found
  if (context.ruleViolations.length > 0) {
    parts.push('## Pre-flight Rule Violations (already detected)');
    parts.push('The following violations were detected by local static analysis. Acknowledge them in your review:');
    for (const v of context.ruleViolations) {
      const loc = v.line ? `:${v.line}` : '';
      parts.push(
        `- [${v.severity.toUpperCase()}] **${v.rule}** in \`${v.file}${loc}\`: ${v.message}`
      );
    }
    parts.push('');
  }

  // Changed files with diffs
  parts.push('## Changed Files');
  for (const file of context.changedFiles) {
    parts.push(`### \`${file.path}\` (${file.status})`);
    parts.push('```diff');
    // Truncate very large diffs to avoid blowing the context
    const maxDiffChars = 8000;
    const diff =
      file.diff.length > maxDiffChars
        ? file.diff.slice(0, maxDiffChars) + '\n... [diff truncated for brevity]'
        : file.diff;
    parts.push(diff);
    parts.push('```');
    parts.push('');
  }

  // Related context files
  if (context.relatedFiles.length > 0) {
    parts.push('## Related Context (for reference — not changed)');
    parts.push('These files are related to the changes and may provide important context:');
    for (const f of context.relatedFiles) {
      parts.push(`### \`${f.path}\``);
      parts.push(`_${f.reason}_`);
      parts.push('```typescript');
      // Cap related file content too
      const maxContentChars = 3000;
      const content =
        f.content.length > maxContentChars
          ? f.content.slice(0, maxContentChars) + '\n// ... [truncated]'
          : f.content;
      parts.push(content);
      parts.push('```');
      parts.push('');
    }
  }

  parts.push('Please review the changes above and provide feedback following the specified format.');

  return parts.join('\n');
}

async function runReview(options: ReviewOptions): Promise<void> {
  const config = loadConfig();

  // Resolve target branch — auto-detect if not provided
  const target = options.target ?? await detectDefaultBranch();
  const isComment = !options.deep;

  // Override config with CLI options
  if (options.mode) config.review.mode = options.mode;
  if (options.provider) config.review.provider = options.provider;

  const effectiveMode = options.deep ? 'deep' : (options.mode ?? config.review.mode);
  if (options.deep) config.review.mode = 'deep';

  const budgetLimit = options.budget
    ? parseFloat(options.budget)
    : process.env.DIFFGUARD_MAX_REVIEW_COST_USD
      ? parseFloat(process.env.DIFFGUARD_MAX_REVIEW_COST_USD)
      : null;
  // Commander transforms --no-ai into options.ai === false
  const skipAi = options.ai === false;

  printHeader('DiffGuard Code Review');

  // Step 1: Fetch remote and analyze git
  const fetchSpinner = ora('Fetching remote branch...').start();
  try {
    await fetchRemoteBranch(target, options.branch);
    const fetched = options.branch
      ? `origin/${target} + origin/${options.branch}`
      : `origin/${target}`;
    fetchSpinner.succeed(`Fetched ${fetched}`);
  } catch (err) {
    fetchSpinner.fail(`Failed to fetch remote branch`);
    const message = err instanceof Error ? err.message : String(err);
    printError(message);
    process.exit(1);
  }

  const analyzeSpinner = ora('Analyzing git diff...').start();
  let gitAnalysis: Awaited<ReturnType<typeof analyzeGit>>;
  try {
    gitAnalysis = await analyzeGit(target, options.branch);
    analyzeSpinner.succeed(`Analysis complete`);
  } catch (err) {
    analyzeSpinner.fail('Git analysis failed');
    const message = err instanceof Error ? err.message : String(err);
    printError(message);
    process.exit(1);
  }

  // Branch info is shown in the footer alongside cost summary

  // Step 3: Branch warnings
  const warnings = checkBranchStatus(gitAnalysis);
  for (const warning of warnings) {
    printWarning(warning);
  }

  if (gitAnalysis.changedFiles.length === 0) {
    printWarning('No changed files detected. Exiting.');
    return;
  }

  // Step 4: Run local rules
  const rulesSpinner = ora('Running local rules...').start();
  const violations = runAllRules(gitAnalysis.changedFiles, config);
  rulesSpinner.succeed(
    `Local rules complete — ${violations.length} violation${violations.length === 1 ? '' : 's'} found`
  );

  printViolations(violations);

  // Step 5: Build context
  const contextSpinner = ora('Building review context...').start();
  const context = await buildContext(
    gitAnalysis.changedFiles,
    violations,
    config
  );
  contextSpinner.succeed('Context built');

  printContextSummary(context);

  // Step 6: Compress large related files (Phase 5)
  if (!skipAi && context.relatedFiles.length > 0 && context.totalTokens > 4_000) {
    const compressSpinner = ora('Compressing context...').start();
    try {
      const provider = getProvider(config);
      const { files: compressed, savedTokens } = await compressRelatedFiles(
        context.relatedFiles,
        provider
      );
      context.relatedFiles = compressed;
      if (savedTokens > 0) {
        context.totalTokens = Math.max(0, context.totalTokens - savedTokens);
        compressSpinner.succeed(`Context compressed — saved ~${savedTokens.toLocaleString()} tokens`);
      } else {
        compressSpinner.succeed('Context ready (no compression needed)');
      }
    } catch {
      compressSpinner.warn('Compression skipped');
    }
  }

  // Step 7: Check budget
  let runAi = !skipAi;

  if (budgetLimit !== null && context.estimatedCost > budgetLimit) {
    printWarning(
      `Estimated cost (${context.estimatedCost.toFixed(4)}) exceeds budget limit ($${budgetLimit.toFixed(2)}). ` +
        `Use --budget <amount> to increase limit, or --no-ai to skip AI review.`
    );
    runAi = false;
  }

  // Step 8: AI review
  let aiResponse: AIResponse | null = null;
  let fromCache = false;

  if (runAi) {
    const model = selectModel(effectiveMode, 'review', config.review.model);
    const systemPrompt = buildSystemPrompt(isComment ? 'comment' : 'standard');
    const userPrompt = buildUserPrompt(context, target, gitAnalysis.currentBranch, gitAnalysis.commitsBehind);
    const cacheMode = isComment ? 'comment' : 'standard';

    // Check cache first (skip if --no-cache)
    if (!options.noCache) {
      const cached = getCached(userPrompt, model, cacheMode);
      if (cached) {
        aiResponse = cached;
        fromCache = true;
        printSuccess(`AI review loaded from cache`);
      }
    }

    if (!aiResponse) {
      const aiSpinner = ora(`Running AI review (${model})...`).start();
      try {
        const provider = getProvider(config);
        aiResponse = await provider.complete(userPrompt, systemPrompt, model);
        setCached(userPrompt, model, cacheMode, aiResponse);
        aiSpinner.succeed(`AI review complete`);
      } catch (err) {
        aiSpinner.fail('AI review failed');
        const message = err instanceof Error ? err.message : String(err);
        printError(`AI error: ${message}`);
        if (message.includes('ANTHROPIC_API_KEY')) {
          printError('Set ANTHROPIC_API_KEY in your .env file to enable AI reviews.');
        }
      }
    }
  } else {
    printWarning('AI review skipped (--no-ai flag set)');
  }

  // Step 9: Print results
  if (aiResponse) {
    const { content: reviewContent, confidence } = extractConfidence(aiResponse.content);
    if (isComment) {
      printCommentReview(reviewContent);
    } else {
      printReview(reviewContent);
    }
    printCostSummary(aiResponse, confidence, {
      currentBranch: gitAnalysis.currentBranch,
      targetBranch: target,
      filesChanged: gitAnalysis.changedFiles.length,
      commitsBehind: gitAnalysis.commitsBehind,
    });

    // Only record usage for live calls, not cache hits
    if (!fromCache) {
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
  }

  // Step 10: Output formats
  if (options.output === 'markdown') {
    await writeMarkdownReport(context, violations, aiResponse, target, gitAnalysis.currentBranch);
    printSuccess(`Markdown report written to ${getReportPath()}`);
  } else if (options.output === 'json') {
    const report = {
      timestamp: new Date().toISOString(),
      targetBranch: target,
      currentBranch: gitAnalysis.currentBranch,
      changedFiles: gitAnalysis.changedFiles.length,
      violations,
      aiReview: aiResponse
        ? {
            content: aiResponse.content,
            cost: aiResponse.cost,
            model: aiResponse.model,
          }
        : null,
    };
    console.log(JSON.stringify(report, null, 2));
  }

  // Final summary
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warnCount = violations.filter((v) => v.severity === 'warning').length;

  console.log('');
  if (errorCount > 0) {
    printError(
      `Review complete — ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warnCount} warning${warnCount === 1 ? '' : 's'}`
    );
    process.exit(1);
  } else if (warnCount > 0) {
    printWarning(
      `Review complete — 0 errors, ${warnCount} warning${warnCount === 1 ? '' : 's'}`
    );
  } else {
    printSuccess('Review complete — no violations found');
  }
}

export const reviewCommand = new Command('review')
  .description('Review changes against a target branch')
  .option('-t, --target <branch>', 'Target branch to compare against (default: auto-detect main/master)')
  .option('-b, --branch <branch>', 'Source branch to review (default: current local branch)')
  .option('--deep', 'Structured deep review instead of default inline comments', false)
  .option('--no-cache', 'Skip cache and force a fresh AI call')
  .option(
    '--mode <mode>',
    'Review mode: fast | balanced | deep',
    (v) => {
      if (!['fast', 'balanced', 'deep'].includes(v)) {
        throw new Error(`Invalid mode: ${v}. Use fast, balanced, or deep.`);
      }
      return v as 'fast' | 'balanced' | 'deep';
    }
  )
  .option('--provider <provider>', 'AI provider to use (e.g. anthropic)')
  .option('--output <format>', 'Output format: markdown | json')
  .option('--no-ai', 'Skip AI review, only run local rules')
  .option('--budget <amount>', 'Maximum spend in USD (e.g. 0.25)')
  .action(async (options: ReviewOptions) => {
    try {
      await runReview(options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      printError(`Unexpected error: ${message}`);
      process.exit(1);
    }
  });
