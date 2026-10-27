---
name: lca-publish-executor
description: Publish local LCA artifact bundles through the unified `tiangong-lca publish run` contract. Use when another skill already produced local publish artifacts and needs one stable publish request instead of per-skill glue.
---

# LCA Publish Executor

## Overview
- Accept one JSON request that points at `publish-bundle.json` files, direct dataset payloads, or `process_from_flow` run ids.
- Forward that request shape to `tiangong-lca publish run`.
- Keep relation metadata local when the publish mode says `local_manifest_only`.
- Reuse publish bundles prepared by upstream CLI-backed builders instead of inventing a second publish contract here.

## When To Use
- Use after `lifecyclemodel-recursive-orchestrator publish`.
- Use after `lifecyclemodel-resulting-process-builder publish`.
- Use when a caller wants one standard publish manifest for multiple skills.
- Use when another caller should know only one publish request shape.

## Commands
```bash
node scripts/run-lca-publish-executor.mjs publish \
  --request assets/example-request.json \
  --dry-run \
  --json
```

## Request Contract
- Read `assets/request.schema.json` for the stable manifest shape.
- Read `references/publish-contract.md` for bundle ingestion rules and relation handling.
- `inputs.bundle_paths[]`: one or more upstream `publish-bundle.json` files.
- `inputs.lifecyclemodels[]` / `processes[]` / `sources[]`: direct dataset payloads or file references.
- `inputs.process_build_runs[]`: delegated `process_from_flow` publish targets; each item needs `run_id`.
- `publish.commit=false` means dry-run preparation only.
- `publish.relation_mode=local_manifest_only` is currently the only supported relation mode.

## Outputs
- whatever `tiangong-lca publish run` emits for the request shape
- at minimum expect `publish-report.json`
- expect `verification-report.json` next to the publish report; read it before treating a dry-run or commit as complete
- when relation mode stays local, also expect a local relation manifest in the publish output bundle

## Notes
- This wrapper is CLI-only; there is no Python or MCP fallback path.
- Before any remote publish, require `tiangong-lca auth doctor-auth --json`. A `login-required` result is a human handoff to `auth login`; never request a password, authorization code, token, or legacy API key. Keep a distinct private session per account/project/client. Headless tokens may come only from an approved orchestrator and never enter argv, prompts, logs, or artifacts.
- Keep this skill as a stable request façade only. Do not add publish internals here.
- Do not publish if upstream identity, build-plan, schema, deterministic QA, Foundry process curation, reference, matrix-readiness, or account-verification gates are missing or blocked.
- If `verification-report.json` contains blockers, stop and hand off the artifact path instead of retrying blindly.
- After a commit-mode publish, run the appropriate post-write verification: `tiangong-lca dataset verify-remote` for TIDAS references and `tiangong-lca process verify-rows` for persisted process row snapshots.

## CLI selection

Use `node scripts/run-cli.mjs` for direct CLI calls so they share this skill wrapper's runtime selection. A consumer may configure `TIANGONG_LCA_CLI_INSTALLATION`, `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_FILE` and `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_SHA256` once in its launch environment. These select an already installed and independently qualified CLI through its public runtime API; normal calls need no per-invocation overrides, Git checkout, pnpm or build. Inspect actual identity and selection source with `node scripts/run-cli.mjs --runtime-info`. Invalid configured evidence fails without falling back.

Without an installed selection, execution stops with CLI setup guidance; Skills never downloads or chooses a CLI version. `--cli-dir` is an explicit development-source path. CLI versions and release locks belong to the installation owner, while Skills depend on the public commands and capabilities they use. Continue existing managed tasks through their original owner-returned actions; do not replace their runtime or replay UNKNOWN operations with this standalone entry.
