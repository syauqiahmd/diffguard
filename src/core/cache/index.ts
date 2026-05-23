import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { cacheDir } from '../paths.js';
import type { AIResponse } from '../../types/index.js';

interface CacheEntry {
  response: AIResponse;
  createdAt: string;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function key(prompt: string, model: string, mode: string): string {
  return createHash('sha256').update(`${prompt}:${model}:${mode}`).digest('hex').slice(0, 16);
}

export function getCached(prompt: string, model: string, mode: string): AIResponse | null {
  const path = join(cacheDir(), `${key(prompt, model, mode)}.json`);
  if (!existsSync(path)) return null;
  try {
    const entry = JSON.parse(readFileSync(path, 'utf-8')) as CacheEntry;
    if (Date.now() - new Date(entry.createdAt).getTime() > TTL_MS) return null;
    return entry.response;
  } catch {
    return null;
  }
}

export function setCached(prompt: string, model: string, mode: string, response: AIResponse): void {
  const dir = cacheDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${key(prompt, model, mode)}.json`);
  writeFileSync(path, JSON.stringify({ response, createdAt: new Date().toISOString() }), 'utf-8');
}
