import type { AIProvider, DiffguardConfig } from '../../types/index.js';
import { AnthropicProvider } from '../../providers/anthropic/index.js';

let _provider: AIProvider | null = null;

export function getProvider(config: DiffguardConfig): AIProvider {
  const providerName = config.review.provider ?? 'anthropic';

  if (_provider && _provider.name === providerName) {
    return _provider;
  }

  if (providerName === 'anthropic') {
    _provider = new AnthropicProvider();
    return _provider;
  }

  throw new Error(
    `Unknown AI provider: '${providerName}'. Currently supported providers: anthropic`
  );
}

export function selectModel(
  mode: string,
  task: 'summarize' | 'review',
  configModel?: string
): string {
  // Priority: CLI config > DIFFGUARD_MODEL env > mode-based default
  if (configModel) return configModel;
  if (task === 'review' && process.env.DIFFGUARD_MODEL) return process.env.DIFFGUARD_MODEL;

  if (task === 'summarize') {
    return 'claude-haiku-4-5';
  }

  switch (mode) {
    case 'fast':
      return 'claude-haiku-4-5';
    case 'balanced':
      return 'claude-sonnet-4-6';
    case 'deep':
      return 'claude-sonnet-4-6';
    default:
      return 'claude-sonnet-4-6';
  }
}

export function resetProvider(): void {
  _provider = null;
}
