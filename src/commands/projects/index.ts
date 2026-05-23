import { Command } from 'commander';
import { join } from 'path';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import Table from 'cli-table3';
import chalk from 'chalk';
import { globalDir } from '../../core/paths.js';
import { formatCost } from '../../core/tokenizer/estimator.js';
import { printHeader, printInfo } from '../../core/formatter/terminal.js';

interface ProjectMeta {
  projectPath?: string;
  name?: string;
  initializedAt?: string;
}

interface UsageLine {
  cost: number;
  date: string;
  [key: string]: unknown;
}

interface ProjectSummary {
  slug: string;
  name: string;
  projectPath: string;
  totalCost: number;
  reviewCount: number;
  lastReviewDate: string | null;
}

function readProjectMeta(projectDirPath: string): ProjectMeta {
  const metaPath = join(projectDirPath, 'meta.json');
  if (!existsSync(metaPath)) return {};
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8')) as ProjectMeta;
  } catch {
    return {};
  }
}

function readUsageSummary(projectDirPath: string): { totalCost: number; reviewCount: number } {
  const usagePath = join(projectDirPath, 'usage.jsonl');
  if (!existsSync(usagePath)) return { totalCost: 0, reviewCount: 0 };

  let totalCost = 0;
  let reviewCount = 0;

  try {
    const lines = readFileSync(usagePath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const record = JSON.parse(trimmed) as UsageLine;
        totalCost += typeof record.cost === 'number' ? record.cost : 0;
        reviewCount += 1;
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // ignore read errors
  }

  return { totalCost, reviewCount };
}

function readLastReviewDate(projectDirPath: string): string | null {
  const reviewsDirPath = join(projectDirPath, 'reviews');
  if (!existsSync(reviewsDirPath)) return null;

  let mdFiles: string[];
  try {
    mdFiles = readdirSync(reviewsDirPath).filter((f) => f.endsWith('.md'));
  } catch {
    return null;
  }

  if (mdFiles.length === 0) return null;

  mdFiles.sort();
  const latest = mdFiles[mdFiles.length - 1]!;
  const match = latest.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1]! : null;
}

function loadProjects(): ProjectSummary[] {
  const projectsDir = join(globalDir(), 'projects');

  if (!existsSync(projectsDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(projectsDir);
  } catch {
    return [];
  }

  const projects: ProjectSummary[] = [];

  for (const entry of entries) {
    const entryPath = join(projectsDir, entry);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const meta = readProjectMeta(entryPath);
    const { totalCost, reviewCount } = readUsageSummary(entryPath);
    const lastReviewDate = readLastReviewDate(entryPath);

    projects.push({
      slug: entry,
      name: meta.name ?? entry,
      projectPath: meta.projectPath ?? '',
      totalCost,
      reviewCount,
      lastReviewDate,
    });
  }

  return projects;
}

function runProjects(): void {
  printHeader('DiffGuard Projects');

  const projects = loadProjects();

  if (projects.length === 0) {
    printInfo('No projects found. Run `diffguard init` in a project directory to get started.');
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan('Project'),
      chalk.cyan('Path'),
      chalk.cyan('Reviews'),
      chalk.cyan('Total Cost'),
      chalk.cyan('Last Review'),
    ],
    style: { head: [], border: [] },
    colWidths: [24, 36, 10, 14, 14],
  });

  for (const project of projects) {
    const name = chalk.cyan(
      project.name.length > 22 ? project.name.slice(0, 19) + '...' : project.name
    );
    const path =
      project.projectPath.length > 34
        ? '...' + project.projectPath.slice(-(31))
        : project.projectPath || chalk.dim('—');
    const reviews = project.reviewCount.toString();
    const cost = chalk.green(formatCost(project.totalCost));
    const lastReview = project.lastReviewDate ?? chalk.dim('never');

    table.push([name, path, reviews, cost, lastReview]);
  }

  console.log(table.toString());
  console.log('');
}

export const projectsCommand = new Command('projects')
  .description('List all diffguard-initialized projects')
  .action(() => {
    try {
      runProjects();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
