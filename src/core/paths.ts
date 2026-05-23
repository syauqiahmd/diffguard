import { homedir } from 'os';
import { join, basename } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'fs';

function projectSlug(cwd: string): string {
  const name = basename(cwd) || 'unknown';
  const hash = [...cwd]
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0)
    .toString(16)
    .padStart(4, '0');
  return `${name}-${hash}`;
}

export function globalDir(): string {
  return join(homedir(), '.diffguard');
}

export function projectDir(cwd: string = process.cwd()): string {
  return join(globalDir(), 'projects', projectSlug(cwd));
}

export function globalConfigPath(cwd: string = process.cwd()): string {
  return join(projectDir(cwd), 'config.yaml');
}

export function usagePath(cwd: string = process.cwd()): string {
  return join(projectDir(cwd), 'usage.jsonl');
}

export function reviewsDir(cwd: string = process.cwd()): string {
  return join(projectDir(cwd), 'reviews');
}

export function cacheDir(cwd: string = process.cwd()): string {
  return join(projectDir(cwd), 'cache');
}

export function metaPath(cwd: string = process.cwd()): string {
  return join(projectDir(cwd), 'meta.json');
}

export function reviewReportPath(branch: string, cwd: string = process.cwd()): string {
  const date = new Date().toISOString().split('T')[0];
  const safeBranch = branch.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 35); // 35 + separator + 4-char suffix = 40 total
  const uniq = Date.now().toString(36).slice(-4);
  return join(reviewsDir(cwd), `${date}-${safeBranch}-${uniq}.md`);
}

export function ensureProjectDir(cwd: string = process.cwd()): void {
  mkdirSync(projectDir(cwd), { recursive: true });
  mkdirSync(reviewsDir(cwd), { recursive: true });

  const meta = metaPath(cwd);
  if (!existsSync(meta)) {
    writeFileSync(meta, JSON.stringify({
      projectPath: cwd,
      name: basename(cwd),
      initializedAt: new Date().toISOString(),
    }, null, 2));
  }
}
