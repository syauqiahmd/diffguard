# Diffguard

AI-powered code review for your git diffs — runs locally, costs cents, catches real issues.

Diffguard diffs your branch against a target, runs local rule checks, then sends only the relevant context to AI for review. You get inline comments with impact tags (`[data-loss]`, `[api-break]`, `[security]`), fix snippets, a confidence score, and a cost breakdown — all in one command.

Works with any stack and any language. No full repo upload. No subscription. Your API key, your cost.

---

## Install

```bash
git clone https://github.com/syauqiahmd/diffguard.git
cd diffguard
./install.sh
```

The script installs dependencies, builds, links `diffguard` as a global command, and prompts you to choose a default provider, enter API keys, and pick a default model. All credentials are saved to the diffguard `.env` — run it once, re-run after pulling updates.

You can fill credentials for multiple providers or skip any you don't plan to use. Keys for non-default providers are optional and can be added later.

---

## Setup in your project

Run this **inside the project you want to review** — required before any other command:

```bash
cd /path/to/your-project
diffguard init
```

Detects your stack (Node.js / Go, framework, ORM, validation library) and saves config to `~/.diffguard/projects/<your-project>/config.yaml`. Running `review`, `pr`, or `usage` without `init` will show an error and stop.

The config picks up your default provider from the global `.env` set during install, so you don't need to reconfigure credentials per project.

---

## Usage

Run from **your project directory**. All commands auto-detect `main` or `master` if `-t` is omitted.

### Review

```bash
# Review your current local branch vs origin/main (default)
diffguard review

# Review against a specific target branch
diffguard review -t staging

# Review a remote branch without checking it out (great for partner PRs)
diffguard review -b feature/johns-fix
diffguard review -b feature/johns-fix -t staging

# Structured deep review instead of inline comments
diffguard review --deep

# Save report to ~/.diffguard/projects/<project>/reviews/
diffguard review --output markdown

# Local rules only, skip AI
diffguard review --no-ai

# Cap spend per run
diffguard review --budget 0.05

# Force fresh AI call (skip 24h cache)
diffguard review --no-cache
```

### Source branch behaviour

| Command | Source | Target |
|---|---|---|
| `diffguard review` | Local HEAD (your current branch, last commit) | auto-detected `main`/`master` |
| `diffguard review -t staging` | Local HEAD | `origin/staging` |
| `diffguard review -b feature/fix` | `origin/feature/fix` | auto-detected `main`/`master` |
| `diffguard review -b feature/fix -t staging` | `origin/feature/fix` | `origin/staging` |

> **Note:** Only committed changes are included. Uncommitted / staged-but-not-committed work is not seen. Run `git commit` first if you want WIP changes reviewed.

### PR description

```bash
# Generate PR title, summary, why, and test plan
diffguard pr

# For a remote branch without checking out
diffguard pr -b feature/johns-fix

# Save to file
diffguard pr --output pr.md
```

### Cost dashboard

```bash
diffguard usage
```

### List all projects

```bash
diffguard projects
```

---

## Output

### Inline comment mode (default)

Every issue tagged with its impact type, capped fix snippet, and a summary + confidence score at the end:

```
  counterService.js:25 -> [api-break] total record count removed from response
    fix: return { totalRecord: count, data };
  queueService.js:309  -> [data-loss] DB update replaced with hardcoded mock
    fix: await this.prisma.ticket.update({ where: { id: queueId...

Summary: Two breaking changes — API contract break and data persistence lost.
Confidence: 95%

────────────────────────────────────────
  feature/my-fix → origin/main  2 files
  ────────────────────────────────────────
  Provider: anthropic / claude-haiku-4-5
  Confidence:    95%
  Input tokens:  1.6k
  Output tokens: 247
  Actual cost:   $0.0028
────────────────────────────────────────
```

### Impact tags

| Tag | Meaning |
|---|---|
| `[api-break]` | Breaks API contract or response shape |
| `[data-loss]` | Data not persisted, lost, or corrupted |
| `[security]` | Auth bypass, injection, secret exposure |
| `[async-bug]` | Missing await, race condition, unhandled rejection |
| `[perf]` | Unbounded query, N+1, memory risk |
| `[logic]` | Wrong conditional, off-by-one, bad fallback |

### Deep mode (`--deep`)

Compact structured sections instead of inline comments:

```
ISSUES
  • counterService.js:25 — total count removed, breaks pagination clients
    fix: return { totalRecord: count, data }

RECS
  1. Restore count query before merge

Summary: Pagination metadata stripped — API contract broken.
Confidence: 92%
```

---

## Config

Lives at `~/.diffguard/projects/<your-project>/config.yaml` — nothing written into your repos.

```yaml
version: 1

review:
  mode: balanced          # fast | balanced | deep
  provider: anthropic
  # model: claude-haiku-4-5   # uncomment to override DIFFGUARD_MODEL env

rules:
  max_complexity: 15
  forbidden:
    - "console.log"
    - "debugger"
  required:
    - "validate("          # enforce validation pattern

architecture:
  no_direct_db_access: true
  controller_must_not_contain_business_logic: true

ignore:
  - "dist/"
  - "coverage/"
  - "node_modules/"
  - "*.lock"
```

---

## Providers

Diffguard supports four AI providers. Set `DIFFGUARD_PROVIDER` in your `.env` to choose.

| Provider | Key needed | Cheapest model | Notes |
|---|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-haiku-4-5` — $1/$5 per 1M | Default |
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` — $0.15/$0.60 per 1M | |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.0-flash` — $0.10/$0.40 per 1M | |
| `ollama` | none | any local model | Free, fully offline |

You can also switch provider per-project in `config.yaml`:

```yaml
review:
  provider: openai
  model: gpt-4o-mini
```

Or per-run with the existing `--provider` flag:

```bash
diffguard review --provider gemini
```

---

## Environment variables

Set in the diffguard `.env` file:

```env
# Provider — anthropic | openai | gemini | ollama (default: anthropic)
DIFFGUARD_PROVIDER=anthropic

# API key for your chosen provider
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GEMINI_API_KEY=...

# Model override (optional — auto-selected by provider + mode if unset)
# Anthropic:  claude-haiku-4-5 / claude-sonnet-4-6 / claude-opus-4-7
# OpenAI:     gpt-4o-mini / gpt-4o / gpt-4.1
# Gemini:     gemini-2.0-flash / gemini-1.5-pro
# Ollama:     llama3.2 / qwen2.5-coder / mistral / any installed model
DIFFGUARD_MODEL=claude-haiku-4-5

# Budget caps
DIFFGUARD_MAX_REVIEW_COST_USD=0.10
DIFFGUARD_MAX_SESSION_COST_USD=2.00

# Ollama base URL (default: http://localhost:11434)
# OLLAMA_BASE_URL=http://localhost:11434
```

Priority order: `--provider` flag > `config.yaml review.provider` > `DIFFGUARD_PROVIDER` env > `anthropic`.

---

## Global data directory

Nothing is written into your projects — everything lives in `~/.diffguard/`:

```
~/.diffguard/
  projects/
    your-project-a3f2/
      config.yaml         ← rules and settings (diffguard init)
      usage.jsonl         ← cost log (diffguard usage)
      meta.json           ← project path, initialized date
      cache/              ← 24h review cache (keyed by diff hash)
      reviews/
        2026-05-24-feature-auth.md
        2026-05-24-fix-pagination.md
    another-project-b7c1/
      ...
```

---

## Updating

```bash
cd /path/to/diffguard
git pull
./install.sh
```

---

## How it works

```
git fetch origin
↓
diff origin/<target>...<source>   (source = HEAD or origin/<branch>)
↓
Local rule engine (forbidden patterns, architecture rules)
↓
Import-aware context builder      (parses imports, finds actual dependencies)
↓
Context compression               (large files summarized by haiku)
↓
Review cache check                (skip AI if same diff seen in last 24h)
↓
AI review (Anthropic / OpenAI / Gemini / Ollama, temperature=0 for consistency)
↓
Formatted output with impact tags + confidence score
```

---

## Tech stack

- TypeScript ESM, Node.js 22+
- `@anthropic-ai/sdk`, `openai`, `@google/genai` — direct SDKs, prompt caching (Anthropic), `temperature: 0`
- `simple-git`, `commander`, `zod`, `chalk`, `ora`, `cli-table3`
- No full repo upload — only diffs + minimal related file context
