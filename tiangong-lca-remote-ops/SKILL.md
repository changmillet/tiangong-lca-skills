---
name: tiangong-lca-remote-ops
description: Wrap TianGong CLI process maintenance commands for authenticated remote process refreshes and local post-write verification. Use when tasks need current-user process reference refreshes, resumable process maintenance artifacts, or strict local verification of fetched process rows.
---

# TianGong LCA Remote Ops

## Scope
- This skill is a thin wrapper around native `tiangong-lca process ...` commands.
- Use it when the task is specifically about remote `processes` maintenance or post-write verification.
- Do not add business-specific runtime logic, Supabase auth code, or custom `.env` parsing into this skill. If capability is missing, add it to `tiangong-cli` first.

## Canonical Commands
- Refresh current-user process references:

```bash
node tiangong-lca-remote-ops/scripts/update-process-references.mjs \
  --out-dir /abs/path/process-refresh \
  --dry-run
```

- Commit the refresh after the local gate passes:

```bash
node tiangong-lca-remote-ops/scripts/update-process-references.mjs \
  --out-dir /abs/path/process-refresh \
  --apply
```

- Verify frozen rows after any remote write:

```bash
node tiangong-lca-remote-ops/scripts/verify-process-rows.mjs \
  --rows-file /abs/path/process-list-report.json \
  --out-dir /abs/path/post-write-verification
```

- For multi-type TIDAS reference verification, use the public dataset command through `current-account-dataset-review`:

```bash
node current-account-dataset-review/scripts/run-current-account-dataset-review.mjs verify-remote \
  --input /abs/path/rows.jsonl \
  --out-dir /abs/path/dataset-verify-remote
```

## Runtime Contract
- Remote refresh uses canonical CLI env only:
  - `TIANGONG_LCA_API_BASE_URL`
  - `TIANGONG_LCA_SUPABASE_PUBLISHABLE_KEY`
  - `TIANGONG_LCA_OAUTH_CLIENT_ID`
- Run `tiangong-lca auth status --json` before remote reads and `tiangong-lca auth doctor-auth --json` before `--apply`. If login is required, stop and ask the human to run `auth login` in a trusted terminal.
- Never ask for or print a username, password, authorization code, token, or legacy API key. A headless orchestrator may inject one short-lived access token without exposing it to argv, prompts, logs, or artifacts.
- Use a separate private `TIANGONG_LCA_SESSION_FILE` for each account/project/client.
- `verify-process-rows` is local-only and does not require remote credentials by itself.
- Wrapper-local `--cli-dir` is the only supported override for choosing a local CLI checkout.

## Guardrails
- Never hardcode or print passwords, access tokens, refresh tokens, authorization codes, decoded legacy payloads, or raw secret env values.
- Keep `--out-dir` explicit so manifests, progress logs, blockers, and verification artifacts are reproducible.
- Before any remote write, apply the state-driven routing rule in [references/process-write-routing.md](references/process-write-routing.md).
- Treat local `ProcessSchema` validation plus unresolved-reference checks as the hard gate, not HTTP success alone.
- If upstream identity, build-plan, Foundry process curation, reference, or matrix-readiness reports contain blockers, do not call the remote write path.
- Preserve post-write verification artifacts in the handoff; a successful HTTP response is not sufficient evidence.

## CLI selection

Use `node scripts/run-cli.mjs` for direct CLI calls so they share this skill wrapper's runtime selection. A consumer may configure `TIANGONG_LCA_CLI_INSTALLATION`, `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_FILE` and `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_SHA256` once in its launch environment. These select an already installed and independently qualified CLI through its public runtime API; normal calls need no per-invocation overrides, Git checkout, pnpm or build. Inspect actual identity and selection source with `node scripts/run-cli.mjs --runtime-info`. Invalid configured evidence fails without falling back.

Without an installed selection, execution stops with CLI setup guidance; Skills never downloads or chooses a CLI version. `--cli-dir` is an explicit development-source path. CLI versions and release locks belong to the installation owner, while Skills depend on the public commands and capabilities they use. Continue existing managed tasks through their original owner-returned actions; do not replace their runtime or replay UNKNOWN operations with this standalone entry.
