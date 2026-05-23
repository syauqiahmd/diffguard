import type { ChangedFile, DiffguardConfig, RuleViolation } from '../../types/index.js';

export function checkForbiddenPatterns(
  files: ChangedFile[],
  forbidden: string[]
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const file of files) {
    if (file.status === 'deleted') continue;

    const lines = file.diff.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Only check added lines (lines starting with '+' but not '+++')
      if (!line.startsWith('+') || line.startsWith('+++')) continue;

      const content = line.slice(1); // Remove the leading '+'

      for (const pattern of forbidden) {
        if (content.includes(pattern)) {
          violations.push({
            rule: 'forbidden-pattern',
            severity: 'error',
            file: file.path,
            line: i + 1,
            message: `Forbidden pattern '${pattern}' found in added code`,
          });
        }
      }
    }
  }

  return violations;
}

export function checkRequiredPatterns(
  files: ChangedFile[],
  required: string[]
): RuleViolation[] {
  if (!required || required.length === 0) return [];

  const violations: RuleViolation[] = [];

  for (const file of files) {
    if (file.status === 'deleted') continue;

    // Only check files that look like they handle requests/routes/handlers
    const isHandlerFile =
      /\.(controller|handler|route|router|service)\.(ts|js)$/.test(file.path) ||
      /router|controller|handler/i.test(file.path);

    if (!isHandlerFile) continue;

    const addedContent = file.diff
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1))
      .join('\n');

    for (const pattern of required) {
      if (!addedContent.includes(pattern)) {
        violations.push({
          rule: 'required-pattern',
          severity: 'warning',
          file: file.path,
          message: `Handler file may be missing '${pattern}' — ensure all inputs are validated`,
        });
      }
    }
  }

  return violations;
}

const DB_ACCESS_PATTERNS = [
  /\b(prisma|sequelize|typeorm|mongoose|knex|pg|mysql|sqlite)\b.*\.(findMany|findOne|findAll|findById|query|raw|execute|create|update|delete|upsert)/i,
  /new\s+(Repository|EntityManager)\b/,
  /getRepository\s*\(/,
  /DataSource\s*\./,
  /\$queryRaw\b/,
  /createQueryBuilder\s*\(/,
];

const BUSINESS_LOGIC_PATTERNS = [
  /\b(calculate|compute|process|transform|validate|aggregate|reconcile)\w*\s*\(/i,
  /if\s*\(.*&&.*&&/,  // Complex conditionals (multiple AND conditions)
  /switch\s*\(\s*\w+\s*\)\s*\{[\s\S]{200,}\}/,  // Long switch statements
];

export function checkArchitectureRules(
  files: ChangedFile[],
  archRules: DiffguardConfig['architecture']
): RuleViolation[] {
  if (!archRules) return [];

  const violations: RuleViolation[] = [];

  for (const file of files) {
    if (file.status === 'deleted') continue;

    const isController =
      /\.(controller)\.(ts|js)$/.test(file.path) ||
      /controller/i.test(file.path);

    const addedLines = file.diff
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'));

    if (archRules.no_direct_db_access && isController) {
      for (let i = 0; i < addedLines.length; i++) {
        const line = addedLines[i] ?? '';
        const content = line.slice(1);

        for (const pattern of DB_ACCESS_PATTERNS) {
          if (pattern.test(content)) {
            violations.push({
              rule: 'no-direct-db-access',
              severity: 'error',
              file: file.path,
              line: i + 1,
              message:
                'Controller appears to access the database directly. Move data access to a service/repository layer.',
            });
            break;
          }
        }
      }
    }

    if (archRules.controller_must_not_contain_business_logic && isController) {
      const addedContent = addedLines.map((l) => l.slice(1)).join('\n');

      for (const pattern of BUSINESS_LOGIC_PATTERNS) {
        if (pattern.test(addedContent)) {
          violations.push({
            rule: 'no-business-logic-in-controller',
            severity: 'warning',
            file: file.path,
            message:
              'Controller may contain business logic. Consider moving complex logic to a dedicated service.',
          });
          break;
        }
      }
    }
  }

  return violations;
}

export function runAllRules(
  files: ChangedFile[],
  config: DiffguardConfig
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  // Forbidden pattern checks
  if (config.rules.forbidden && config.rules.forbidden.length > 0) {
    violations.push(...checkForbiddenPatterns(files, config.rules.forbidden));
  }

  // Required pattern checks
  if (config.rules.required && config.rules.required.length > 0) {
    violations.push(...checkRequiredPatterns(files, config.rules.required));
  }

  // Architecture rule checks
  if (config.architecture) {
    violations.push(...checkArchitectureRules(files, config.architecture));
  }

  // Deduplicate by file+rule+line
  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.file}:${v.rule}:${v.line ?? 0}:${v.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
