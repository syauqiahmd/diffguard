import { readFileSync, writeFileSync, existsSync } from 'fs';
import { suppressionStatsPath, ensureProjectDir } from '../paths.js';

interface PatternEntry {
  text: string;
  count: number;
  files: string[];
}

interface SuppressionStats {
  [branch: string]: {
    patterns: PatternEntry[];
  };
}

function loadStats(): SuppressionStats {
  const path = suppressionStatsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SuppressionStats;
  } catch {
    return {};
  }
}

function saveStats(stats: SuppressionStats): void {
  try {
    ensureProjectDir();
    writeFileSync(suppressionStatsPath(), JSON.stringify(stats, null, 2), 'utf-8');
  } catch {}
}

export function recordInlineSuppression(branch: string, file: string, text: string): void {
  const stats = loadStats();
  if (!stats[branch]) stats[branch] = { patterns: [] };

  const patterns = stats[branch]!.patterns;
  const existing = patterns.find((p) => p.text === text);

  if (existing) {
    existing.count++;
    if (!existing.files.includes(file)) existing.files.push(file);
  } else {
    patterns.push({ text, count: 1, files: [file] });
  }

  saveStats(stats);
}

export function getThresholdPatterns(branch: string, threshold = 3): PatternEntry[] {
  const stats = loadStats();
  const branchStats = stats[branch];
  if (!branchStats) return [];
  // Only suggest when threshold is reached across multiple files
  return branchStats.patterns.filter(
    (p) => p.count >= threshold && p.files.length >= 2
  );
}

export function resetBranchStats(branch: string): void {
  const stats = loadStats();
  delete stats[branch];
  saveStats(stats);
}
