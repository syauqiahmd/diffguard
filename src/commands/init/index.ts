import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';
import { DEFAULT_CONFIG_YAML } from '../../core/config/defaults.js';
import { printHeader, printSuccess, printWarning, printInfo } from '../../core/formatter/terminal.js';
import { globalConfigPath, ensureProjectDir, projectDir } from '../../core/paths.js';
import chalk from 'chalk';

interface DetectedStack {
  language: 'nodejs' | 'go' | 'unknown';
  framework: string[];
  orm: string[];
  queue: string[];
  validation: string[];
}

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function detectStack(cwd: string): DetectedStack {
  const detected: DetectedStack = {
    language: 'unknown',
    framework: [],
    orm: [],
    queue: [],
    validation: [],
  };

  // Detect language
  if (existsSync(resolve(cwd, 'package.json'))) {
    detected.language = 'nodejs';

    const pkg = readJsonFile(resolve(cwd, 'package.json'));
    if (pkg) {
      const allDeps = {
        ...((pkg['dependencies'] as Record<string, string>) ?? {}),
        ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
      };

      const depNames = Object.keys(allDeps);

      // Frameworks
      const frameworkMap: Record<string, string> = {
        express: 'Express',
        fastify: 'Fastify',
        hapi: 'Hapi',
        '@nestjs/core': 'NestJS',
        koa: 'Koa',
      };
      for (const [dep, name] of Object.entries(frameworkMap)) {
        if (depNames.includes(dep)) detected.framework.push(name);
      }

      // ORMs
      const ormMap: Record<string, string> = {
        '@prisma/client': 'Prisma',
        typeorm: 'TypeORM',
        sequelize: 'Sequelize',
        mongoose: 'Mongoose',
        knex: 'Knex',
        drizzle: 'DrizzleORM',
      };
      for (const [dep, name] of Object.entries(ormMap)) {
        if (depNames.some((d) => d === dep || d.startsWith(dep))) {
          detected.orm.push(name);
        }
      }

      // Queues
      const queueMap: Record<string, string> = {
        bull: 'Bull',
        bullmq: 'BullMQ',
        'bee-queue': 'Bee Queue',
        agenda: 'Agenda',
        rabbitmq: 'RabbitMQ',
        amqplib: 'AMQP (RabbitMQ)',
        ioredis: 'Redis (ioredis)',
      };
      for (const [dep, name] of Object.entries(queueMap)) {
        if (depNames.includes(dep)) detected.queue.push(name);
      }

      // Validation
      const validationMap: Record<string, string> = {
        joi: 'Joi',
        zod: 'Zod',
        'class-validator': 'class-validator',
        yup: 'Yup',
        ajv: 'AJV',
        vest: 'Vest',
      };
      for (const [dep, name] of Object.entries(validationMap)) {
        if (depNames.includes(dep)) detected.validation.push(name);
      }
    }
  } else if (existsSync(resolve(cwd, 'go.mod'))) {
    detected.language = 'go';

    const goMod = readFileSync(resolve(cwd, 'go.mod'), 'utf-8');

    if (goMod.includes('github.com/gin-gonic/gin')) detected.framework.push('Gin');
    if (goMod.includes('github.com/gofiber/fiber')) detected.framework.push('Fiber');
    if (goMod.includes('github.com/labstack/echo')) detected.framework.push('Echo');
    if (goMod.includes('gorm.io/gorm')) detected.orm.push('GORM');
    if (goMod.includes('github.com/go-redis/redis')) detected.queue.push('Redis');
  }

  return detected;
}

function buildConfigYaml(stack: DetectedStack): string {
  const forbidden = ['console.log', 'debugger', 'TODO', 'FIXME'];
  const required: string[] = [];

  // Add validation library to required patterns
  if (stack.validation.length > 0) {
    if (stack.validation.includes('Joi')) required.push('validate(');
    if (stack.validation.includes('Zod')) required.push('.parse(');
    if (stack.validation.includes('class-validator')) required.push('@IsString');
  }

  const config = {
    version: 1,
    review: {
      mode: 'balanced',
      provider: process.env.DIFFGUARD_PROVIDER ?? 'anthropic',
    },
    rules: {
      max_complexity: 15,
      forbidden,
      required,
    },
    architecture: {
      no_direct_db_access: stack.orm.length > 0,
      controller_must_not_contain_business_logic: stack.framework.length > 0,
    },
    ignore: ['dist/', 'coverage/', 'node_modules/', '.git/', '*.min.js', '*.lock'],
  };

  // Build YAML manually for readability
  let yaml = `version: ${config.version}\n\n`;
  yaml += `review:\n`;
  yaml += `  mode: ${config.review.mode}\n`;
  yaml += `  provider: ${config.review.provider}\n`;
  yaml += `  # model: claude-haiku-4-5   # uncomment to override DIFFGUARD_MODEL env\n\n`;
  yaml += `rules:\n`;
  yaml += `  max_complexity: ${config.rules.max_complexity}\n`;
  yaml += `  forbidden:\n`;
  for (const p of config.rules.forbidden) {
    yaml += `    - "${p}"\n`;
  }
  if (config.rules.required.length > 0) {
    yaml += `  required:\n`;
    for (const p of config.rules.required) {
      yaml += `    - "${p}"\n`;
    }
  }
  yaml += `\narchitecture:\n`;
  yaml += `  no_direct_db_access: ${config.architecture.no_direct_db_access}\n`;
  yaml += `  controller_must_not_contain_business_logic: ${config.architecture.controller_must_not_contain_business_logic}\n`;
  yaml += `\nignore:\n`;
  for (const p of config.ignore) {
    yaml += `  - "${p}"\n`;
  }

  return yaml;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runInit(): Promise<void> {
  const cwd = process.cwd();

  printHeader('DiffGuard Init');

  // Detect stack
  printInfo('Scanning project...');
  const stack = detectStack(cwd);

  console.log('');
  console.log(chalk.bold('  Detected stack:'));
  console.log(chalk.dim(`  Language:   ${stack.language}`));

  if (stack.framework.length > 0) {
    console.log(chalk.dim(`  Framework:  ${stack.framework.join(', ')}`));
  }
  if (stack.orm.length > 0) {
    console.log(chalk.dim(`  ORM:        ${stack.orm.join(', ')}`));
  }
  if (stack.queue.length > 0) {
    console.log(chalk.dim(`  Queue:      ${stack.queue.join(', ')}`));
  }
  if (stack.validation.length > 0) {
    console.log(chalk.dim(`  Validation: ${stack.validation.join(', ')}`));
  }
  console.log('');

  // Check for existing config (global dir first, then local fallback)
  const configPath = globalConfigPath(cwd);
  const localConfigPath = resolve(cwd, 'diffguard.yaml');
  const configExists = existsSync(configPath) || existsSync(localConfigPath);

  if (configExists) {
    printWarning(`Config already exists for this project.`);
    const answer = await ask('  Overwrite? (y/N): ');
    if (!answer.toLowerCase().startsWith('y')) {
      printInfo('Keeping existing config.');
      return;
    }
  }

  // Ask about generating recommended rules
  const generateRules = await ask('  Generate recommended rules? (Y/n): ');
  const useRecommended = !generateRules || generateRules.toLowerCase().startsWith('y');

  let configContent: string;
  if (useRecommended && stack.language !== 'unknown') {
    configContent = buildConfigYaml(stack);
    printInfo('Generating config based on detected stack...');
  } else {
    configContent = DEFAULT_CONFIG_YAML;
    printInfo('Using default config...');
  }

  // Write config to global dir
  ensureProjectDir(cwd);
  writeFileSync(configPath, configContent, 'utf-8');
  printSuccess(`Config saved → ${projectDir(cwd)}/config.yaml`);

  // Write .env.example into the target project
  const envExamplePath = resolve(cwd, '.env.example');
  const envExampleContent = `# ── Required ──────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=your-key-here

# ── Model override (optional) ─────────────────────────────────────────────────
# Model            Cost (input / output per 1M tokens)   Best for
# ─────────────────────────────────────────────────────────────────
# claude-haiku-4-5    $1.00 / $5.00   ← cheapest       --comment, quick checks
# claude-sonnet-4-6   $3.00 / $15.00  ← default        --deep, balanced review
# claude-opus-4-7     $5.00 / $25.00  ← best quality   critical reviews
#
DIFFGUARD_MODEL=claude-haiku-4-5

# ── Budget limits (optional) ──────────────────────────────────────────────────
DIFFGUARD_MAX_REVIEW_COST_USD=0.10
DIFFGUARD_MAX_SESSION_COST_USD=2.00
`;

  writeFileSync(envExamplePath, envExampleContent, 'utf-8');
  printSuccess('Created .env.example');

  printSuccess('DiffGuard initialized successfully!');
  console.log('');
  console.log(chalk.dim('  Next steps:'));
  console.log(chalk.dim(`  1. Edit config if needed: ${projectDir(cwd)}/config.yaml`));
  console.log(chalk.dim('  2. Run: diffguard review'));
  console.log('');
}

export const initCommand = new Command('init')
  .description('Initialize DiffGuard in the current project')
  .action(async () => {
    try {
      await runInit();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
