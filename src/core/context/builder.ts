import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import type { ChangedFile, ContextFile, DiffguardConfig, ReviewContext, RuleViolation } from '../../types/index.js';
import { estimateTokens, estimateCost } from '../tokenizer/estimator.js';

const MAX_RELATED_FILES = 10;
const MAX_FILE_SIZE_BYTES = 50_000; // 50KB cap per file

// Extensions to look for when finding related files
const RELATED_SUFFIXES = [
  '.service.ts',
  '.service.js',
  '.schema.ts',
  '.schema.js',
  '.middleware.ts',
  '.middleware.js',
  '.types.ts',
  '.types.js',
  '.dto.ts',
  '.dto.js',
  '.repository.ts',
  '.repository.js',
  '.model.ts',
  '.model.js',
  '.interface.ts',
  '.interface.js',
  '.validator.ts',
  '.validator.js',
  '.test.ts',
  '.spec.ts',
];

function isIgnored(filePath: string, ignore: string[]): boolean {
  for (const pattern of ignore) {
    if (filePath.includes(pattern.replace(/\/$/, ''))) return true;
  }
  return false;
}

function findRelatedFiles(
  changedFile: ChangedFile,
  ignore: string[],
  alreadyIncluded: Set<string>
): ContextFile[] {
  const related: ContextFile[] = [];
  const cwd = process.cwd();
  const dir = dirname(changedFile.path);
  const base = basename(changedFile.path, extname(changedFile.path));

  // Remove common suffixes to get the base name (e.g., "user.controller" -> "user")
  const cleanBase = base
    .replace(/\.(controller|handler|route|router)$/, '')
    .replace(/\.(service|repository|schema|middleware)$/, '');

  const candidatePaths = new Set<string>();

  // Look for files with related suffixes using the clean base name
  for (const suffix of RELATED_SUFFIXES) {
    const candidate = resolve(cwd, dir, `${cleanBase}${suffix}`);
    candidatePaths.add(candidate);

    // Also try with original base name
    const candidate2 = resolve(cwd, dir, `${base}${suffix}`);
    candidatePaths.add(candidate2);
  }

  // Also look in parent directory's types/ or interfaces/ folder
  const parentDir = dirname(dir);
  const typesDirs = ['types', 'interfaces', 'schemas', 'dto'];
  for (const td of typesDirs) {
    const candidate = resolve(cwd, dir, td, `${cleanBase}.ts`);
    candidatePaths.add(candidate);
    const candidate2 = resolve(cwd, parentDir, td, `${cleanBase}.ts`);
    candidatePaths.add(candidate2);
  }

  for (const candidatePath of candidatePaths) {
    // Get relative path for display
    const relativePath = candidatePath.replace(cwd + '/', '');

    // Skip if: already included, is the changed file itself, ignored, or doesn't exist
    if (alreadyIncluded.has(relativePath)) continue;
    if (relativePath === changedFile.path) continue;
    if (isIgnored(relativePath, ignore)) continue;
    if (!existsSync(candidatePath)) continue;

    try {
      const stats = readFileSync(candidatePath);
      if (stats.length > MAX_FILE_SIZE_BYTES) continue;

      const content = readFileSync(candidatePath, 'utf-8');
      const tokenEstimate = estimateTokens(content);

      related.push({
        path: relativePath,
        content,
        reason: `Related to changed file: ${changedFile.path}`,
        tokenEstimate,
      });

      alreadyIncluded.add(relativePath);
    } catch {
      // Skip files we can't read
    }
  }

  return related;
}

export async function buildContext(
  changedFiles: ChangedFile[],
  violations: RuleViolation[],
  config: DiffguardConfig
): Promise<ReviewContext> {
  const ignore = config.ignore ?? ['dist/', 'coverage/', 'node_modules/', '.git/'];
  const relatedFiles: ContextFile[] = [];
  const alreadyIncluded = new Set<string>(changedFiles.map((f) => f.path));

  // Collect related files for each changed file
  for (const changedFile of changedFiles) {
    if (relatedFiles.length >= MAX_RELATED_FILES) break;

    const related = findRelatedFiles(changedFile, ignore, alreadyIncluded);
    const remaining = MAX_RELATED_FILES - relatedFiles.length;
    relatedFiles.push(...related.slice(0, remaining));
  }

  // Calculate total tokens
  const changedFilesTokens = changedFiles.reduce(
    (sum, f) => sum + estimateTokens(f.diff),
    0
  );
  const relatedFilesTokens = relatedFiles.reduce(
    (sum, f) => sum + f.tokenEstimate,
    0
  );
  const violationsTokens = estimateTokens(JSON.stringify(violations));

  // Add overhead for system prompt and structure
  const systemPromptOverhead = 1000;
  const totalTokens = changedFilesTokens + relatedFilesTokens + violationsTokens + systemPromptOverhead;

  // Estimate output tokens (heuristic: ~500-1500 depending on size)
  const estimatedOutputTokens = Math.min(
    1500,
    Math.max(500, Math.ceil(totalTokens * 0.1))
  );

  const model = config.review.model ?? 'claude-sonnet-4-6';
  const estimatedCost = estimateCost(totalTokens, estimatedOutputTokens, model);

  return {
    changedFiles,
    relatedFiles,
    ruleViolations: violations,
    totalTokens,
    estimatedCost,
  };
}
