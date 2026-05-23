// Pricing per 1M tokens (input, output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-7':            { input: 5.0,  output: 25.0 },
  'claude-opus-4-6':            { input: 5.0,  output: 25.0 },
  'claude-sonnet-4-6':          { input: 3.0,  output: 15.0 },
  'claude-haiku-4-5':           { input: 1.0,  output: 5.0  },
  // OpenAI
  'gpt-4o':                     { input: 2.5,  output: 10.0 },
  'gpt-4o-mini':                { input: 0.15, output: 0.6  },
  'gpt-4.1':                    { input: 2.0,  output: 8.0  },
  'gpt-4.1-mini':               { input: 0.4,  output: 1.6  },
  // Gemini
  'gemini-2.0-flash':           { input: 0.1,  output: 0.4  },
  'gemini-2.5-flash-preview':   { input: 0.15, output: 0.6  },
  'gemini-1.5-pro':             { input: 1.25, output: 5.0  },
  // Ollama — free/local
  'ollama':                     { input: 0.0,  output: 0.0  },
};

const DEFAULT_PRICING = MODEL_PRICING['claude-sonnet-4-6']!;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  provider?: string
): number {
  if (provider === 'ollama') return 0;
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

export function formatCost(cost: number): string {
  if (cost < 0.001) {
    return `$${(cost * 1000).toFixed(3)}m`;
  }
  return `$${cost.toFixed(4)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return String(tokens);
}
