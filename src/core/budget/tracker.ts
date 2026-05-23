import { existsSync, appendFileSync, readFileSync } from 'fs';
import type { UsageRecord } from '../../types/index.js';
import { formatCost, formatTokens } from '../tokenizer/estimator.js';
import { usagePath, ensureProjectDir } from '../paths.js';

export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    ensureProjectDir();
    appendFileSync(usagePath(), JSON.stringify(record) + '\n', 'utf-8');
  } catch {
    // Non-fatal — disk errors must not crash the CLI after a successful review
  }
}

function readAllUsage(): UsageRecord[] {
  const path = usagePath();
  if (!existsSync(path)) return [];

  try {
    const content = readFileSync(path, 'utf-8');
    return content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as UsageRecord)
      .filter((r) => r && r.date);
  } catch {
    return [];
  }
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function getWeekAgoString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0] ?? '';
}

export async function getTodayUsage(): Promise<UsageRecord[]> {
  const today = getTodayString();
  return readAllUsage().filter((r) => r.date.startsWith(today));
}

export async function getWeekUsage(): Promise<UsageRecord[]> {
  const weekAgo = getWeekAgoString();
  return readAllUsage().filter((r) => r.date >= weekAgo);
}

export function formatUsageSummary(records: UsageRecord[]): string {
  if (records.length === 0) {
    return 'No usage records found.';
  }

  const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
  const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);

  const lines = [
    `Reviews: ${records.length}`,
    `Total cost: ${formatCost(totalCost)}`,
    `Input tokens: ${formatTokens(totalInputTokens)}`,
    `Output tokens: ${formatTokens(totalOutputTokens)}`,
  ];

  return lines.join('\n');
}
