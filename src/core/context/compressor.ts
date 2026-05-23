import type { ContextFile, AIProvider } from '../../types/index.js';
import { estimateTokens } from '../tokenizer/estimator.js';

const COMPRESS_THRESHOLD_CHARS = 2_500;
const HAIKU = 'claude-haiku-4-5';
const SYSTEM = 'You are a code summarizer. Output a compact technical summary only — no preamble.';

async function summarize(file: ContextFile, provider: AIProvider): Promise<string> {
  const prompt =
    `Summarize this file for a backend code reviewer in 5-8 lines max.\n` +
    `Focus on: exports, key functions/classes, important patterns, anything relevant to code review.\n\n` +
    `File: ${file.path}\n\`\`\`\n${file.content.slice(0, 6_000)}\n\`\`\``;

  try {
    const res = await provider.complete(prompt, SYSTEM, HAIKU);
    return `// [diffguard summary]\n${res.content.trim()}`;
  } catch {
    return file.content;
  }
}

export async function compressRelatedFiles(
  files: ContextFile[],
  provider: AIProvider,
  spinner?: { text: string }
): Promise<{ files: ContextFile[]; savedTokens: number }> {
  let savedTokens = 0;
  const results: ContextFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;

    if (spinner) {
      spinner.text = `Compressing context (${i + 1}/${files.length}): ${file.path}`;
    }

    if (file.content.length <= COMPRESS_THRESHOLD_CHARS) {
      results.push(file);
      continue;
    }

    const summary = await summarize(file, provider);
    const originalTokens = file.tokenEstimate;
    const newTokens = estimateTokens(summary);
    savedTokens += Math.max(0, originalTokens - newTokens);

    results.push({
      ...file,
      content: summary,
      reason: file.reason + ' [summarized]',
      tokenEstimate: newTokens,
    });
  }

  return { files: results, savedTokens };
}
