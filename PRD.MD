# Diffguard

## Tagline

```txt
Local-first AI engineering assistant for backend teams.
```

---

# Vision

Diffguard is a local-first AI-powered engineering review CLI focused on:

* backend engineering workflows
* production-grade code review
* architecture-aware analysis
* git-aware context
* cost-efficient AI usage

The goal is NOT to become another generic AI wrapper.

The goal is to become:

```txt
An intelligent engineering workflow assistant.
```

---

# Core Principles

## 1. Local-first

Never upload entire repository.

Only send:

* meaningful context
* relevant snippets
* summarized architecture
* targeted diffs

Benefits:

* privacy
* lower cost
* faster review
* less hallucination

---

## 2. AI is the last reasoning layer

Most checks should happen locally.

AI should only be used for:

* reasoning
* architecture analysis
* security interpretation
* async/system flow analysis

NOT:

* linting
* formatting
* syntax checks

---

## 3. Cost-aware by default

Every review should:

* estimate tokens
* estimate cost
* optimize context automatically
* support review budget limits

---

## 4. Git-aware workflow

Reviews should compare against:

```txt
origin/target-branch
```

NOT:

```txt
local target branch
```

This prevents outdated review context.

---

## 5. Engineering-aware

Diffguard should understand:

* architecture patterns
* backend structure
* async systems
* repository/service layering
* validation flows
* observability practices

---

# Primary Target Users

## Initial Target

Backend engineers using:

* Node.js
* Express.js
* Hapi.js
* NestJS
* Go Fiber
* Gin

---

## Secondary Target

Teams with:

* PR review process
* engineering standards
* architecture governance
* production systems

---

# Main Use Cases

## Use Case 1

```bash
diffguard review --target staging
```

Review current branch against latest remote staging.

---

## Use Case 2

```bash
diffguard review --deep
```

Run architecture-aware deep analysis.

---

## Use Case 3

```bash
diffguard init
```

Scan repository and generate:

* diffguard.yaml
* .env.example
* recommended rules

---

## Use Case 4

```bash
diffguard usage
```

Show token and cost history.

---

# MVP Scope (V1)

## MUST HAVE

### CLI

* review command
* init command
* usage command

### Git Analysis

* compare against remote branch
* detect changed files
* fetch latest remote branch

### Rule Engine

* forbidden patterns
* complexity checks
* architecture rules
* validation enforcement

### Context Builder

* collect related files
* import-aware context
* dependency extraction

### AI Adapter

* OpenAI
* Anthropic
* Gemini
* Ollama

### Cost Awareness

* token estimation
* estimated cost
* session usage tracking

### Output

* terminal output
* markdown report

---

# V2 Scope

* semantic repository understanding
* architecture graph
* PR collision detection
* smarter context scoring
* repository memory
* CI integration

---

# V3 Scope

* VSCode extension
* SaaS dashboard
* centralized policies
* team analytics
* review history dashboard
* organization-level governance

---

# Technical Architecture

# High-Level Pipeline

```txt
CLI Command
  ↓
Git Analyzer
  ↓
Branch Intelligence
  ↓
Rule Engine
  ↓
Context Builder
  ↓
Dependency Resolver
  ↓
Context Compression
  ↓
Token Estimator
  ↓
AI Router
  ↓
AI Provider Adapter
  ↓
Review Formatter
  ↓
Terminal / Markdown Output
```

---

# Tech Stack

## Language

TypeScript

Reason:

* easier AI-assisted development with Claude
* strong ecosystem
* faster MVP iteration
* easier AST tooling
* easier npm distribution

---

## Runtime

Node.js

Recommended:

* Node.js 22+

---

## CLI Framework

Recommended:

### Primary

```txt
commander
```

### Optional

```txt
oclif
```

---

## Package Manager

pnpm

---

## AI SDK

Recommended:

```txt
Vercel AI SDK
```

Benefits:

* multi-provider support
* streaming
* unified interface
* easy model switching

---

## Validation

zod

---

## YAML Parsing

yaml

---

## Git Integration

simple-git

---

## AST Parsing

### Node.js / TS

```txt
@babel/parser
```

or:

```txt
ts-morph
```

---

## Complexity Analysis

Recommended:

```txt
typhonjs-escomplex
```

---

## Token Estimation

Recommended:

```txt
tiktoken
```

---

## Terminal UI

Recommended:

```txt
chalk
ora
cli-table3
```

---

# Project Structure

```txt
src/
  commands/
    review/
    init/
    usage/

  core/
    git/
    rules/
    context/
    compression/
    tokenizer/
    ai/
    formatter/
    budget/
    config/

  providers/
    openai/
    anthropic/
    gemini/
    ollama/

  analyzers/
    complexity/
    architecture/
    validation/

  utils/
  types/
```

---

# CLI Commands

# 1. Review Command

## Example

```bash
diffguard review --target staging
```

---

## Flags

| Flag       | Description                |
| ---------- | -------------------------- |
| --target   | target branch              |
| --deep     | deep architecture analysis |
| --mode     | fast/balanced/deep         |
| --provider | override provider          |
| --output   | markdown/json              |
| --no-ai    | local checks only          |
| --budget   | max review budget          |

---

# 2. Init Command

## Example

```bash
diffguard init
```

---

## Responsibilities

Detect:

* language
* framework
* ORM
* queue system
* validation library
* testing framework

Generate:

* diffguard.yaml
* .env.example
* ignore patterns
* architecture rules

---

## Example UX

```txt
✔ Node.js detected
✔ Express.js detected
✔ Prisma detected
✔ Redis detected

Generate recommended rules? (Y/n)
Enable architecture checks? (Y/n)
```

---

# 3. Usage Command

## Example

```bash
diffguard usage
```

---

## Output

```txt
Today:
$0.42

This week:
$2.11

Most expensive review:
feature/payment-refactor
```

---

# Git Analyzer

# Responsibilities

* fetch remote branch
* compare against origin branch
* detect changed files
* detect commit count behind
* detect branch mismatch

---

# Example Flow

```bash
git fetch origin staging
git diff HEAD origin/staging
```

---

# Example Output

```json
{
  "targetBranch": "origin/staging",
  "changedFiles": [
    "auth.service.ts",
    "auth.controller.ts"
  ]
}
```

---

# Branch Intelligence

# Responsibilities

Detect:

* outdated local branch
* overlapping merged PRs
* changed architecture around same module

---

# Example Warning

```txt
⚠ Local staging is 14 commits behind origin/staging
```

---

# Rule Engine

# Philosophy

Use deterministic checks first.

Avoid unnecessary AI usage.

---

# Initial Rules

## Complexity

```yaml
max_complexity: 15
```

---

## Forbidden Patterns

```yaml
forbidden:
  - console.log
  - prisma.$queryRaw
```

---

## Required Rules

```yaml
required:
  - validation
```

---

## Architecture Rules

```yaml
architecture:
  no_direct_db_access: true
  controller_must_not_contain_business_logic: true
```

---

# Context Builder

# MOST IMPORTANT MODULE

Purpose:

* gather minimal meaningful context

---

# Input

Changed file:

```txt
auth.controller.ts
```

---

# Include

```txt
auth.service.ts
auth.schema.ts
auth.middleware.ts
```

---

# Exclude

```txt
payment/
notifications/
```

---

# Context Compression

# Purpose

Reduce token usage.

---

# Example

Instead of raw file:

```txt
AuthService:
- handles login/register
- uses Redis invalidation
- uses Prisma transaction
```

Then attach only critical snippets.

---

# Token Budget Awareness

# Before Review

```txt
Context Analysis
──────────────────────
Changed files: 4
Relevant files: 11
Compressed context: enabled

Estimated tokens:
- Input: 18,420
- Output: 2,100

Estimated cost:
~$0.07
```

---

# After Review

```txt
Review Completed
──────────────────────
Provider: OpenAI
Model: gpt-5-mini

Input tokens: 17,993
Output tokens: 1,884

Estimated cost:
$0.0642
```

---

# Cost Control

## ENV

```env
DIFFGUARD_MAX_SESSION_COST_USD=2
DIFFGUARD_MAX_REVIEW_COST_USD=0.25
```

---

# Smart Downgrade

Example:

```txt
⚠ Estimated review exceeds budget.

Suggested optimizations:
- use fast mode
- reduce context depth
- switch to low-cost model
```

---

# AI Model Strategy

# Low Model

Used for:

* summarization
* compression
* relevance scoring
* preprocessing

Examples:

* GPT-5 nano
* Gemini Flash
* Claude Haiku

---

# High Model

Used for:

* architecture reasoning
* security review
* async/system analysis

Examples:

* Claude Sonnet
* GPT-5 mini

---

# Recommended ENV

```env
# LOW MODEL
DIFFGUARD_LOW_MODEL_PROVIDER=openai
DIFFGUARD_LOW_MODEL=gpt-5-nano

# HIGH MODEL
DIFFGUARD_HIGH_MODEL_PROVIDER=anthropic
DIFFGUARD_HIGH_MODEL=claude-sonnet-4
```

---

# AI Routing

# Example

| Task                | Model |
| ------------------- | ----- |
| summarize           | low   |
| compress            | low   |
| relevance scoring   | low   |
| architecture review | high  |
| security review     | high  |

---

# AI Provider System

# Supported Providers

* OpenAI
* Anthropic
* Gemini
* Ollama

---

# Folder Structure

```txt
providers/
  openai/
  anthropic/
  gemini/
  ollama/
```

---

# Config Files

# 1. .env

Runtime config.

---

# 2. diffguard.yaml

Repository-level engineering rules.

---

# Example diffguard.yaml

```yaml
version: 1

review:
  mode: balanced

rules:
  max_complexity: 15

  forbidden:
    - console.log
    - prisma.$queryRaw

architecture:
  no_direct_db_access: true

ignore:
  - dist/
  - coverage/
```

---

# Output Formats

# Terminal Output

```txt
✔ Authentication flow looks good

⚠ Missing validation
POST /users has no Joi schema

⚠ Architecture concern
Controller directly accesses Prisma client
```

---

# Markdown Report

Generate:

```txt
.diffguard/review.md
```

---

# Cost Optimization Strategies

# 1. Local checks first

Never use AI for simple checks.

---

# 2. Smart context pruning

Only send:

* changed files
* related imports
* architecture-relevant snippets

---

# 3. Compression layer

Convert large files into summaries.

---

# 4. Chunking

Split reviews by concern.

---

# 5. Hash cache

Do not resend unchanged files.

---

# 6. Ignore noise

Never send:

* dist/
* coverage/
* generated/
* package-lock.json

---

# Security Considerations

* never upload entire repo
* support local LLM
* redact secrets
* ignore .env files
* ignore generated credentials

---

# Recommended Development Roadmap

# Phase 1 — Foundation

## Goals

* CLI setup
* config loading
* git integration
* review command

---

# Phase 2 — Local Analysis

## Goals

* rule engine
* complexity analyzer
* architecture rules
* context builder

---

# Phase 3 — AI Layer

## Goals

* provider abstraction
* low/high model routing
* compression pipeline
* cost estimation

---

# Phase 4 — DX

## Goals

* pretty terminal output
* markdown reports
* usage tracking
* init command

---

# Phase 5 — Advanced Intelligence

## Goals

* branch intelligence
* PR collision detection
* repository memory
* semantic analysis

---

# LinkedIn Positioning

## Recommended Positioning

```txt
Building a local-first AI engineering assistant focused on architecture-aware backend code review and cost-efficient AI workflows.
```

---

# Open Source Strategy

## Recommendation

Open-source core CLI.

Potential future monetization:

* SaaS dashboard
* team policies
* analytics
* enterprise governance

---

# Biggest Differentiator

Diffguard is NOT:

```txt
another AI chat wrapper
```

Diffguard IS:

```txt
A git-aware engineering workflow intelligence tool.
```

---

# Final Success Criteria

The project succeeds if developers feel:

```txt
This tool understands engineering workflows better than generic AI coding assistants.
```
