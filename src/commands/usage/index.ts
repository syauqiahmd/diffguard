import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import { getTodayUsage, getWeekUsage } from '../../core/budget/tracker.js';
import { formatCost, formatTokens } from '../../core/tokenizer/estimator.js';
import { printHeader, printInfo } from '../../core/formatter/terminal.js';
import { requireInit } from '../../core/init-guard.js';
import type { UsageRecord } from '../../types/index.js';

function summarizeRecords(records: UsageRecord[]): {
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  count: number;
  byModel: Record<string, { cost: number; count: number }>;
} {
  const byModel: Record<string, { cost: number; count: number }> = {};

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;

  for (const r of records) {
    totalCost += r.cost;
    totalInput += r.inputTokens;
    totalOutput += r.outputTokens;

    if (!byModel[r.model]) {
      byModel[r.model] = { cost: 0, count: 0 };
    }
    byModel[r.model]!.cost += r.cost;
    byModel[r.model]!.count += 1;
  }

  return { totalCost, totalInput, totalOutput, count: records.length, byModel };
}

function findMostExpensive(records: UsageRecord[]): UsageRecord | null {
  if (records.length === 0) return null;
  return records.reduce((max, r) => (r.cost > max.cost ? r : max));
}

async function runUsage(): Promise<void> {
  requireInit();
  printHeader('DiffGuard Usage');

  const [todayRecords, weekRecords] = await Promise.all([
    getTodayUsage(),
    getWeekUsage(),
  ]);

  const todaySummary = summarizeRecords(todayRecords);
  const weekSummary = summarizeRecords(weekRecords);
  const mostExpensive = findMostExpensive(weekRecords);

  // Overview table
  console.log(chalk.bold('  Overview\n'));

  const overviewTable = new Table({
    head: [chalk.cyan('Period'), chalk.cyan('Reviews'), chalk.cyan('Cost'), chalk.cyan('Input'), chalk.cyan('Output')],
    style: { head: [], border: [] },
    colWidths: [12, 10, 14, 14, 14],
  });

  overviewTable.push([
    'Today',
    todaySummary.count.toString(),
    formatCost(todaySummary.totalCost),
    formatTokens(todaySummary.totalInput),
    formatTokens(todaySummary.totalOutput),
  ]);

  overviewTable.push([
    'This week',
    weekSummary.count.toString(),
    formatCost(weekSummary.totalCost),
    formatTokens(weekSummary.totalInput),
    formatTokens(weekSummary.totalOutput),
  ]);

  console.log(overviewTable.toString());
  console.log('');

  // Model breakdown
  if (weekSummary.count > 0) {
    console.log(chalk.bold('  Model breakdown (this week)\n'));

    const modelTable = new Table({
      head: [chalk.cyan('Model'), chalk.cyan('Reviews'), chalk.cyan('Cost'), chalk.cyan('Avg/review')],
      style: { head: [], border: [] },
      colWidths: [30, 10, 14, 14],
    });

    for (const [model, data] of Object.entries(weekSummary.byModel)) {
      const avg = data.cost / data.count;
      modelTable.push([model, data.count.toString(), formatCost(data.cost), formatCost(avg)]);
    }

    console.log(modelTable.toString());
    console.log('');
  }

  // Most expensive review
  if (mostExpensive) {
    console.log(chalk.bold('  Most expensive review (this week)\n'));

    const date = new Date(mostExpensive.date).toLocaleString();
    const detailTable = new Table({
      style: { head: [], border: [] },
    });

    detailTable.push(
      ['Date', date],
      ['Branch', mostExpensive.branch],
      ['Model', `${mostExpensive.provider}/${mostExpensive.model}`],
      ['Input tokens', formatTokens(mostExpensive.inputTokens)],
      ['Output tokens', formatTokens(mostExpensive.outputTokens)],
      ['Cost', chalk.bold(formatCost(mostExpensive.cost))]
    );

    console.log(detailTable.toString());
    console.log('');
  }

  // Recent reviews
  if (weekRecords.length > 0) {
    console.log(chalk.bold('  Recent reviews (this week)\n'));

    const recentTable = new Table({
      head: [chalk.cyan('Date'), chalk.cyan('Branch'), chalk.cyan('Model'), chalk.cyan('Cost')],
      style: { head: [], border: [] },
      colWidths: [22, 24, 22, 12],
    });

    // Show last 10 reviews, most recent first
    const recent = [...weekRecords].reverse().slice(0, 10);
    for (const r of recent) {
      const date = new Date(r.date).toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const branch = r.branch.length > 22 ? r.branch.slice(0, 19) + '...' : r.branch;
      recentTable.push([date, branch, r.model, formatCost(r.cost)]);
    }

    console.log(recentTable.toString());
    console.log('');
  }

  if (weekSummary.count === 0) {
    printInfo('No usage records found for this week. Run `diffguard review` to get started.');
  }
}

export const usageCommand = new Command('usage')
  .description('Show AI usage statistics and cost breakdown')
  .action(async () => {
    try {
      await runUsage();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
