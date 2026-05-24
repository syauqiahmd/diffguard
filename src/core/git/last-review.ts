import { readFileSync, writeFileSync, existsSync } from 'fs';
import { lastReviewPath, ensureProjectDir } from '../paths.js';

interface BranchReview {
  sha: string;
  reviewedAt: string;
}

interface LastReviewState {
  [branch: string]: BranchReview;
}

function load(): LastReviewState {
  const path = lastReviewPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as LastReviewState;
  } catch {
    return {};
  }
}

function save(state: LastReviewState): void {
  try {
    ensureProjectDir();
    writeFileSync(lastReviewPath(), JSON.stringify(state, null, 2), 'utf-8');
  } catch {}
}

export function getLastReviewedSha(branch: string): string | null {
  return load()[branch]?.sha ?? null;
}

export function setLastReviewedSha(branch: string, sha: string): void {
  const state = load();
  state[branch] = { sha, reviewedAt: new Date().toISOString() };
  save(state);
}

export function resetBranchReview(branch: string): void {
  const state = load();
  delete state[branch];
  save(state);
}
