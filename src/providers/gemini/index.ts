import { GoogleGenAI } from '@google/genai';
import type { AIProvider, AIResponse } from '../../types/index.js';
import { estimateTokens, estimateCost } from '../../core/tokenizer/estimator.js';
import { getEnv } from '../../core/config/loader.js';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private apiKey: string;

  constructor() {
    const apiKey = getEnv('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is not set. ' +
          'Set it in your .env file or export it in your shell.'
      );
    }

    this.apiKey = apiKey;
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  async complete(
    prompt: string,
    system: string,
    model: string = 'gemini-2.0-flash'
  ): Promise<AIResponse> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: system,
        temperature: 0,
        maxOutputTokens: 4096,
      },
    });

    const content = response.text ?? '';
    const inputTokens =
      response.usageMetadata?.promptTokenCount ?? estimateTokens(prompt + system);
    const outputTokens =
      response.usageMetadata?.candidatesTokenCount ?? estimateTokens(content);
    const cost = estimateCost(inputTokens, outputTokens, model);

    return {
      content,
      inputTokens,
      outputTokens,
      cost,
      model,
      provider: 'gemini',
    };
  }
}
