---
name: embedding-ft
description: Execute and troubleshoot Supabase edge function `embedding_ft` that consumes PGMQ embedding jobs, calls AWS SageMaker embeddings, and writes vectors back to Postgres. Use when validating job payload handling, investigating failed embeddings, tuning ack semantics, or adjusting worker auth/environment.
---

# Embedding FT

## Run Workflow
1. The wrapper uses the configured installed CLI, or the repository-pinned distribution default when no installation is configured. Use `TIANGONG_LCA_CLI_DIR` or `--cli-dir` only for an exact local dev/CI override.
2. Configure the API base URL, Supabase publishable key, and environment-specific public OAuth client ID.
3. Run `tiangong-lca auth doctor-auth --json`. If it returns `login-required`, stop and ask the human user to run `tiangong-lca auth login` in a trusted terminal.
4. Execute `node scripts/run-embedding-ft.mjs` with standard `tiangong-lca admin embedding-run` flags.
5. The wrapper delegates to `tiangong-lca admin embedding-run`; the CLI resolves and refreshes its private OAuth session.
6. Inspect `completedJobs` and `failedJobs`, then triage via references.

Never ask an AI user for a username, password, authorization code, access token, refresh token, or the deprecated encoded API key. Headless runs may use only an orchestrator-injected short-lived `TIANGONG_LCA_ACCESS_TOKEN`; do not pass it through argv, prompts, logs, or artifacts.

## Commands
```bash
TIANGONG_LCA_API_BASE_URL="https://example.supabase.co/functions/v1" \
TIANGONG_LCA_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
TIANGONG_LCA_OAUTH_CLIENT_ID="<public-oauth-client-id>" \
tiangong-lca auth doctor-auth --json

TIANGONG_LCA_API_BASE_URL="https://example.supabase.co/functions/v1" \
TIANGONG_LCA_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
TIANGONG_LCA_OAUTH_CLIENT_ID="<public-oauth-client-id>" \
node scripts/run-embedding-ft.mjs --dry-run

TIANGONG_LCA_API_BASE_URL="https://example.supabase.co/functions/v1" \
TIANGONG_LCA_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
TIANGONG_LCA_OAUTH_CLIENT_ID="<public-oauth-client-id>" \
node scripts/run-embedding-ft.mjs

node scripts/run-embedding-ft.mjs \
  --input ./assets/example-jobs.json \
  --base-url "https://example.supabase.co/functions/v1"

# Force a local CLI working tree during dev/CI
TIANGONG_LCA_CLI_DIR=/path/to/tiangong-lca-cli \
node scripts/run-embedding-ft.mjs \
  --dry-run \
  --base-url "https://example.supabase.co/functions/v1"
```

## Fast Triage
- `400`: request body is not a valid job array.
- `500`: SageMaker request/response parsing failure.
- `completedJobs < submitted`: inspect queue payload, row version, and content function output.

## Load References On Demand
- `references/env.md`: auth and caller environment.
- `references/job-contract.md`: queue semantics and DB side effects.
- `references/testing.md`: smoke-test and debug checklist.

## CLI selection

Use `node scripts/run-cli.mjs` for direct CLI calls so they share this skill wrapper's runtime selection. A consumer may configure `TIANGONG_LCA_CLI_INSTALLATION`, `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_FILE` and `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_SHA256` once in its launch environment. These select an already installed and independently qualified CLI through its public runtime API; normal calls need no per-invocation overrides, Git checkout, pnpm or build. Inspect actual identity and selection source with `node scripts/run-cli.mjs --runtime-info`. Invalid configured evidence fails without falling back.

Without an installed selection, the standalone distribution default remains pinned. `--cli-dir` is an explicit development-source path; `--published-cli` explicitly selects the distribution default. Continue existing managed tasks through their original owner-returned actions; do not replace their runtime or replay UNKNOWN operations with this standalone entry.
