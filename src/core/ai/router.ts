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
  // If user has explicitly set a model in config, respect it
  if (configModel) return configModel;

  if (task === 'summarize') {
    // Always use haiku for summarization — it's fast and cheap
    return 'claude-haiku-4-5';
  }

  // For review tasks, select based on mode
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
