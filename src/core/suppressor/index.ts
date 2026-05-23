import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { DiffguardConfig, SuppressRule } from '../../types/index.js';

interface ParsedFinding {
  file: string;
  line: number | null;
  text: string;     // full note after the arrow
  rawLines: string[]; // original lines (finding + optional fix:)
}

const INLINE_IGNORE = /\/\/\s*diffguard-ignore|#\s*diffguard-ignore/i;

function hasInlineIgnore(file: string, line: number): boolean {
  const filePath = resolve(process.cwd(), file);
  if (!existsSync(filePath)) return false;
  try {
    const fileLines = readFileSync(filePath, 'utf-8').split('\n');
    const above = fileLines[line - 2] ?? ''; // line above (1-indexed → 0-indexed - 1)
    const same  = fileLines[line - 1] ?? ''; // the flagged line itself
    return INLINE_IGNORE.test(above) || INLINE_IGNORE.test(same);
  } catch {
    return false;
  }
}

function matchesRule(finding: ParsedFinding, rule: SuppressRule): boolean {
  if (rule.file && !finding.file.includes(rule.file)) return false;
  if (rule.line !== undefined && finding.line !== rule.line) return false;
  if (rule.contains && !finding.text.toLowerCase().includes(rule.contains.toLowerCase())) return false;
  if (rule.tag && !finding.text.toLowerCase().includes(`[${rule.tag.toLowerCase()}]`)) return false;
  return true;
}

function isSuppressed(finding: ParsedFinding, rules: SuppressRule[]): boolean {
  if (finding.line !== null && hasInlineIgnore(finding.file, finding.line)) return true;
  return rules.some((rule) => matchesRule(finding, rule));
}

export function applySuppressions(
  content: string,
  config: DiffguardConfig
): { content: string; suppressedCount: number } {
  const rules = config.suppress ?? [];
  if (rules.length === 0) {
    // Skip parsing entirely when no rules configured and no inline ignores possible
    return { content, suppressedCount: 0 };
  }

  const lines = content.split('\n');
  const resultLines: string[] = [];
  let suppressedCount = 0;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim().replace(/^[-*•]\s+/, '');

    if (trimmed.includes(' -> ')) {
      const arrowIdx = trimmed.indexOf(' -> ');
      const loc = trimmed.slice(0, arrowIdx).trim();
      const text = trimmed.slice(arrowIdx + 4);

      const locMatch = loc.match(/^(.+?)(?::(\d+))?$/);
      const file = locMatch?.[1]?.trim() ?? loc;
      const line = locMatch?.[2] ? parseInt(locMatch[2], 10) : null;

      const block: string[] = [raw];

      // Collect the fix: line if present
      const next = lines[i + 1];
      if (next) {
        const nextTrimmed = next.trim().replace(/^[-*•]\s+/, '');
        if (nextTrimmed.startsWith('fix:')) {
          block.push(next);
          i++;
        }
      }

      if (isSuppressed({ file, line, text, rawLines: block }, rules)) {
        suppressedCount++;
      } else {
        resultLines.push(...block);
      }
    } else {
      resultLines.push(raw);
    }

    i++;
  }

  return { content: resultLines.join('\n'), suppressedCount };
}
