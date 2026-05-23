// Pricing per 1M tokens (input, output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-opus-4-5': { input: 15.0, output: 75.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
};

const DEFAULT_PRICING = MODEL_PRICING['claude-sonnet-4-6']!;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
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
