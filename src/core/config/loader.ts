import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';
import { globalConfigPath } from '../paths.js';
import dotenv from 'dotenv';
import { z } from 'zod';
import type { DiffguardConfig } from '../../types/index.js';

// 1. Load from diffguard package root (where the CLI's own .env lives)
const __filename = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(__filename), '../../..');
dotenv.config({ path: join(packageRoot, '.env') });

// 2. Load from global ~/.diffguard/.env
dotenv.config({ path: join(homedir(), '.diffguard', '.env') });

// 3. Load from cwd (project-level override — wins over the above)
dotenv.config({ path: resolve(process.cwd(), '.env'), override: true });

const DiffguardConfigSchema = z.object({
  version: z.number().default(1),
  review: z
    .object({
      mode: z.enum(['fast', 'balanced', 'deep']).default('balanced'),
      provider: z.string().optional(),
      model: z.string().optional(),
      incremental: z.boolean().optional().default(false),
    })
    .default({}),
  rules: z
    .object({
      max_complexity: z.number().optional().default(15),
      forbidden: z.array(z.string()).optional().default(['console.log']),
      required: z.array(z.string()).optional().default([]),
    })
    .default({}),
  architecture: z
    .object({
      no_direct_db_access: z.boolean().optional(),
      controller_must_not_contain_business_logic: z.boolean().optional(),
    })
    .optional(),
  ignore: z
    .array(z.string())
    .optional()
    .default(['dist/', 'coverage/', 'node_modules/', '.git/']),
  suppress: z
    .array(
      z.object({
        file:     z.string().optional(),
        line:     z.number().optional(),
        contains: z.string().optional(),
        tag:      z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

const DEFAULT_CONFIG: DiffguardConfig = {
  version: 1,
  review: {
    mode: 'balanced',
    provider: 'anthropic',
    // no default model — lets DIFFGUARD_MODEL env var take effect
  },
  rules: {
    max_complexity: 15,
    forbidden: ['console.log'],
    required: [],
  },
  architecture: {
    no_direct_db_access: true,
    controller_must_not_contain_business_logic: true,
  },
  ignore: ['dist/', 'coverage/', 'node_modules/', '.git/'],
  suppress: [],
};

let _config: DiffguardConfig | null = null;

const VALID_PROVIDERS = new Set(['anthropic', 'openai', 'gemini', 'ollama']);

function tryLoadYaml(configPath: string): DiffguardConfig | null {
  if (!existsSync(configPath)) return null;
  // File exists — let parse errors propagate so callers can report them properly
  const raw = readFileSync(configPath, 'utf-8');
  const parsed = parseYaml(raw) as unknown;
  return DiffguardConfigSchema.parse(parsed) as DiffguardConfig;
}

export function loadConfig(): DiffguardConfig {
  if (_config) return _config;

  try {
    _config =
      tryLoadYaml(globalConfigPath()) ??
      tryLoadYaml(resolve(process.cwd(), 'diffguard.yaml')) ??
      DEFAULT_CONFIG;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\n✗ Config file has invalid syntax: ${message}\n`);
    process.stderr.write(`  Fix your config.yaml or delete it to use defaults.\n\n`);
    process.exit(1);
  }

  const provider = _config.review.provider ?? process.env.DIFFGUARD_PROVIDER;
  if (provider && !VALID_PROVIDERS.has(provider)) {
    process.stderr.write(`\n✗ Invalid provider "${provider}" in config.\n`);
    process.stderr.write(`  Supported: anthropic, openai, gemini, ollama\n\n`);
    process.exit(1);
  }

  return _config;
}

export function getEnv(key: string): string | undefined {
  return process.env[key];
}

export function resetConfigCache(): void {
  _config = null;
}
