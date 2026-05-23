import type { AIProvider, AIResponse } from '../../types/index.js';
import { estimateTokens } from '../../core/tokenizer/estimator.js';

interface OllamaResponse {
  message: { content: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

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
      });
    } catch (err) {
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
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Ollama request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ''}`
      );
    }

    const data = (await response.json()) as OllamaResponse;

    if (!data.message?.content) {
      throw new Error('Ollama returned an empty or malformed response.');
    }

    const inputTokens =
      data.prompt_eval_count ?? estimateTokens(system + prompt);
    const outputTokens =
      data.eval_count ?? estimateTokens(data.message.content);

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
