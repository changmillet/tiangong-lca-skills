---
name: flow-hybrid-search
description: Execute and troubleshoot Supabase edge function `flow_hybrid_search`, which rewrites flow descriptions and calls `hybrid_search_flows` with optional filters. Use when validating flow query/filter behavior, tuning retrieval prompts, or debugging auth, embedding, and RPC failures.
---

# Flow Hybrid Search

## Run Workflow
1. The wrapper uses the configured installed CLI, or the repository-pinned distribution default when no installation is configured. Use `TIANGONG_LCA_CLI_DIR` or `--cli-dir` only for an exact local dev/CI override.
2. Official Production needs no environment setup: the CLI owns its public profile. Only Dev/self-hosted/custom clients need the complete matching configuration in `references/env.md`.
3. Run `tiangong-lca auth status --json`. If it returns `login-required`, stop and ask the human user to run `tiangong-lca auth login` in a trusted terminal.
4. Execute `node scripts/run-flow-hybrid-search.mjs` with standard `tiangong-lca search flow` flags.
5. The wrapper delegates to `tiangong-lca search flow`; the CLI resolves and refreshes its private OAuth session.
6. Confirm response shape, then debug with focused references.

Never ask an AI user for a username, password, authorization code, access token, refresh token, or the deprecated encoded API key. Headless runs require an explicit destination/publishable key and may use only an orchestrator-injected short-lived `TIANGONG_LCA_ACCESS_TOKEN`; do not pass it through argv, prompts, logs, or artifacts.

## Commands

```bash
node scripts/run-cli.mjs auth status --json

# Only the human user completes browser login when login-required is reported
node scripts/run-cli.mjs auth login

node scripts/run-flow-hybrid-search.mjs --dry-run
node scripts/run-flow-hybrid-search.mjs --input ./assets/example-request.json

# Explicit local CLI override for development only
node scripts/run-flow-hybrid-search.mjs --cli-dir /path/to/tiangong-lca-cli --dry-run
```

## Fast Triage

- An independently installed skill includes its launcher and example input; no Skills/CLI/Data Foundry checkout is required. The launcher is a byte-checked bundle of the repository authority, not a separate auth implementation.
- Fresh `auth status` / `doctor-auth` returns `login-required` (exit 1), not a missing Production client. A custom `--base-url` requires matching complete custom configuration.
- `400`: missing or invalid `query`.
- `500`: embedding provider or `hybrid_search_flows` RPC failure.
- Empty `data`: query/filter mismatch; inspect generated retrieval query and filter structure.

## Load References On Demand
- `references/env.md`: auth, region, and endpoint overrides.
- `references/request-response.md`: payload contract and RPC expectations.
- `references/prompts.md`: query-rewrite prompt constraints.
- `references/testing.md`: smoke test checklist.

## CLI selection

Use `node scripts/run-cli.mjs` for direct CLI calls so they share this skill wrapper's runtime selection. A consumer may configure `TIANGONG_LCA_CLI_INSTALLATION`, `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_FILE` and `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_SHA256` once in its launch environment. These select an already installed and independently qualified CLI through its public runtime API; normal calls need no per-invocation overrides, Git checkout, pnpm or build. Inspect actual identity and selection source with `node scripts/run-cli.mjs --runtime-info`. Invalid configured evidence fails without falling back.

Without an installed selection, the standalone distribution default remains pinned. `--cli-dir` is an explicit development-source path; `--published-cli` explicitly selects the distribution default. Continue existing managed tasks through their original owner-returned actions; do not replace their runtime or replay UNKNOWN operations with this standalone entry.
