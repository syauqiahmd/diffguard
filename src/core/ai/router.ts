import type { AIProvider, DiffguardConfig } from '../../types/index.js';
import { AnthropicProvider } from '../../providers/anthropic/index.js';
import { OpenAIProvider } from '../../providers/openai/index.js';
import { GeminiProvider } from '../../providers/gemini/index.js';
import { OllamaProvider } from '../../providers/ollama/index.js';

let _provider: AIProvider | null = null;

export function getProvider(config: DiffguardConfig): AIProvider {
  // Priority: config.yaml > DIFFGUARD_PROVIDER env > 'anthropic'
  const providerName =
    config.review.provider ??
    process.env.DIFFGUARD_PROVIDER ??
    'anthropic';

  if (_provider && _provider.name === providerName) return _provider;

  switch (providerName) {
    case 'anthropic': _provider = new AnthropicProvider(); break;
    case 'openai':    _provider = new OpenAIProvider();    break;
    case 'gemini':    _provider = new GeminiProvider();    break;
    case 'ollama':    _provider = new OllamaProvider();    break;
    default:
      throw new Error(
        `Unknown provider: '${providerName}'. Supported: anthropic, openai, gemini, ollama`
      );
  }

  return _provider;
}

// Default models per provider × mode
const MODEL_DEFAULTS: Record<string, Record<string, string>> = {
  anthropic: { fast: 'claude-haiku-4-5',  balanced: 'claude-sonnet-4-6', deep: 'claude-sonnet-4-6' },
  openai:    { fast: 'gpt-4o-mini',        balanced: 'gpt-4o',            deep: 'gpt-4o'            },
  gemini:    { fast: 'gemini-2.0-flash',   balanced: 'gemini-2.0-flash',  deep: 'gemini-1.5-pro'    },
  ollama:    { fast: 'llama3.2',           balanced: 'llama3.2',          deep: 'llama3.2'           },
};

const VALID_MODES = new Set(['fast', 'balanced', 'deep']);

export function selectModel(
  mode: string,
  task: 'summarize' | 'review',
  configModel?: string
): string {
  // Priority: explicit config model > DIFFGUARD_MODEL env > provider+mode default
  if (configModel) return configModel;
  if (task === 'review' && process.env.DIFFGUARD_MODEL) return process.env.DIFFGUARD_MODEL;

  const provider = process.env.DIFFGUARD_PROVIDER ?? 'anthropic';
  const providerDefaults = MODEL_DEFAULTS[provider] ?? MODEL_DEFAULTS.anthropic!;
  const resolvedMode = VALID_MODES.has(mode) ? mode : 'balanced';

  if (task === 'summarize') {
    return providerDefaults.fast!;
  }

  return providerDefaults[resolvedMode] ?? providerDefaults.balanced!;
}

export function resetProvider(): void {
  _provider = null;
}
