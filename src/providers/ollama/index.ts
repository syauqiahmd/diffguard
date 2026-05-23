import { z } from 'zod';
import type { AIProvider, AIResponse } from '../../types/index.js';
import { estimateTokens } from '../../core/tokenizer/estimator.js';

const TIMEOUT_MS = 60_000;

const OllamaResponseSchema = z.object({
  message: z.object({ content: z.string() }),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
});

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  async complete(
    prompt: string,
    system: string,
    model: string = 'llama3'
  ): Promise<AIResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          stream: false,
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${TIMEOUT_MS / 1000}s. Is the model loaded?`);
      }
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND') ||
        message.includes('ETIMEDOUT') ||
        message.includes('EHOSTUNREACH') ||
        message.includes('ECONNRESET') ||
        message.includes('fetch failed')
      ) {
        throw new Error('Ollama is not running. Start it with: ollama serve');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Ollama request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ''}`
      );
    }

    const raw = await response.json();
    const parsed = OllamaResponseSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(`Ollama returned an unexpected response shape: ${parsed.error.message}`);
    }

    const data = parsed.data;
    const inputTokens = data.prompt_eval_count ?? estimateTokens(system + prompt);
    const outputTokens = data.eval_count ?? estimateTokens(data.message.content);

    return {
      content: data.message.content,
      inputTokens,
      outputTokens,
      cost: 0,
      model,
      provider: 'ollama',
    };
  }
}
