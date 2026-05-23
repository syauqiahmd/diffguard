import OpenAI from 'openai';
import type { AIProvider, AIResponse } from '../../types/index.js';
import { estimateTokens, estimateCost } from '../../core/tokenizer/estimator.js';
import { getEnv } from '../../core/config/loader.js';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor() {
    const apiKey = getEnv('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. ' +
          'Set it in your .env file or export it in your shell.'
      );
    }

    this.client = new OpenAI({ apiKey });
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  async complete(
    prompt: string,
    system: string,
    model: string = 'gpt-4o'
  ): Promise<AIResponse> {
    const totalSize = prompt.length + system.length;
    // Stream above 50KB to avoid blocking on large diffs (matches Anthropic provider threshold)
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
    const response = await this.client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const cost = estimateCost(inputTokens, outputTokens, model, 'openai');

    return {
      content,
      inputTokens,
      outputTokens,
      cost,
      model,
      provider: 'openai',
    };
  }

  private async completeWithStreaming(
    prompt: string,
    system: string,
    model: string
  ): Promise<AIResponse> {
    const stream = this.client.chat.completions.stream({
      model,
      temperature: 0,
      max_tokens: 4096,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });

    const response = await stream.finalChatCompletion();

    const content = response.choices[0]?.message?.content ?? '';
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const cost = estimateCost(inputTokens, outputTokens, model, 'openai');

    return {
      content,
      inputTokens,
      outputTokens,
      cost,
      model,
      provider: 'openai',
    };
  }
}
