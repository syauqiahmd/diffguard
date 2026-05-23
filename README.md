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

The script installs dependencies, builds, and links `diffguard` as a global command. Run it once — re-run after pulling updates.

Add your API key to the diffguard `.env`:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> /path/to/diffguard/.env
echo 'DIFFGUARD_MODEL=claude-haiku-4-5' >> /path/to/diffguard/.env
```

---

## Setup in your project

Run this **inside the project you want to review**:

```bash
cd /path/to/your-project
diffguard init
```

Detects your stack (Node.js / Go, framework, ORM, validation library), saves config to `~/.diffguard/projects/<your-project>/config.yaml`, and writes `.env.example` into your project.

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

## Environment variables

Set in the diffguard `.env` file:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Model — controls cost for every review
# claude-haiku-4-5    $1/$5 per 1M tokens   ← cheapest, good for daily use
# claude-sonnet-4-6   $3/$15 per 1M tokens  ← balanced (default when unset)
# claude-opus-4-7     $5/$25 per 1M tokens  ← best quality
DIFFGUARD_MODEL=claude-haiku-4-5

# Budget caps
DIFFGUARD_MAX_REVIEW_COST_USD=0.10
DIFFGUARD_MAX_SESSION_COST_USD=2.00
```

Model priority: `config.yaml review.model` → `DIFFGUARD_MODEL` env → auto-select by mode.

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
AI review (Anthropic, temperature=0 for consistency)
↓
Formatted output with impact tags + confidence score
```

---

## Tech stack

- TypeScript ESM, Node.js 22+
- `@anthropic-ai/sdk` — direct SDK, prompt caching on every call, `temperature: 0`
- `simple-git`, `commander`, `zod`, `chalk`, `ora`, `cli-table3`
- No full repo upload — only diffs + minimal related file context
