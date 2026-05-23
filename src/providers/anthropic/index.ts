import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIResponse } from '../../types/index.js';
import { estimateTokens, estimateCost } from '../../core/tokenizer/estimator.js';
import { getEnv } from '../../core/config/loader.js';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor() {
    const apiKey = getEnv('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set. ' +
          'Set it in your .env file or export it in your shell.'
      );
    }

    this.client = new Anthropic({ apiKey });
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  async complete(
    prompt: string,
    system: string,
    model: string = 'claude-sonnet-4-6'
  ): Promise<AIResponse> {
    // Use streaming for large prompts (> 50k chars total)
    const totalSize = prompt.length + system.length;
    const useStreaming = totalSize > 50_000;

    if (useStreaming) {
      return this.completeWithStreaming(prompt, system, model);
    }

    return this.completeStandard(prompt, system, model);
  }

  private async completeStandard(
    prompt: string,
    system: string,
    model: string
  ): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = estimateCost(inputTokens, outputTokens, model);

    return {
      content,
      inputTokens,
      outputTokens,
      cost,
      model,
      provider: this.name,
    };
  }

  private async completeWithStreaming(
    prompt: string,
    system: string,
    model: string
  ): Promise<AIResponse> {
    const stream = await this.client.messages.stream({
      model,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const finalMessage = await stream.finalMessage();

    const content = finalMessage.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');

    const inputTokens = finalMessage.usage.input_tokens;
    const outputTokens = finalMessage.usage.output_tokens;
    const cost = estimateCost(inputTokens, outputTokens, model);

    return {
      content,
      inputTokens,
      outputTokens,
      cost,
      model,
      provider: this.name,
    };
  }
}
