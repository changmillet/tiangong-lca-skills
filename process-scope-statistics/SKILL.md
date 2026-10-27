---
name: process-scope-statistics
description: "Delegate to the TianGong CLI to snapshot visible or owner-filtered process rows and compute repeatable coverage statistics for domains, crafts/routes, unit-process rows, and products. Use when you need stable process-scope metrics, especially for `state_code=0/100` maintenance planning."
---

# process-scope-statistics

Use this skill when the task is to answer questions like:
- “这些 process 覆盖多少领域/工艺/产品？”
- “当前可见的 `state_code=0,100` process 有多少单元过程、多少产品？”
- “给我一个以后可重复跑的 process scope 统计方案”

## Workflow

1. Create an output directory first.
2. Ensure the API base URL, Supabase publishable key, and public OAuth client ID are exported, then run `tiangong-lca auth status --json`. If it returns `login-required`, stop and ask the human to run `auth login` in a trusted terminal; never request a username, password, credential, code, or token.
3. Run `node scripts/run-process-scope-statistics.mjs`.
4. Review the JSON summaries and Markdown reports in that output directory.
5. If you need a Chinese report, keep the `.zh-CN.md` output.

## Default Statistical Scope

Unless the user says otherwise, use:
- `--scope visible`
- `--state-codes 0,100`

`visible` means “all process rows visible to the current authenticated session”.
In practice this typically includes:
- draft rows owned by the current account, such as `state_code=0`
- publicly visible rows such as `state_code=100`

## Canonical Script

```bash
node scripts/run-process-scope-statistics.mjs \
  --out-dir /abs/path/process-scope-stats \
  --scope visible \
  --state-code 0 \
  --state-code 100
```

Useful options:
- `--scope current-user`
- `--state-code 0`
- `--state-code 100`
- `--page-size 200`
- `--reuse-snapshot`

The wrapper delegates to the canonical CLI command:

```bash
tiangong-lca process scope-statistics --out-dir /abs/path/process-scope-stats --scope visible --state-code 0 --state-code 100
```

Compatibility note:
- `--state-codes 0,100` is still accepted as a wrapper/CLI alias, but repeatable `--state-code` flags are the canonical shape.

## Outputs

- `inputs/processes.snapshot.manifest.json`
- `inputs/processes.snapshot.rows.jsonl`
- `outputs/process-scope-summary.json`
- `outputs/domain-summary.json`
- `outputs/craft-summary.json`
- `outputs/product-summary.json`
- `outputs/type-of-dataset-summary.json`
- `reports/process-scope-statistics.md`
- `reports/process-scope-statistics.zh-CN.md`

## Metric Definitions

Read `references/metric-definitions.md` when you need the exact counting rules for:
- domain
- craft / route
- unit process
- product

## Notes

- This is a read-only statistics skill; it does not save remote edits.
- Use a separate private session file per account/project/client. Headless execution may use only an orchestrator-injected short-lived access token that never enters argv, prompts, logs, or artifacts.
- The skill is a thin wrapper over `tiangong-lca process scope-statistics`; it does not carry a separate remote runtime or private `.env` parser.
- The metric layer is deterministic and string-based. It does not try to semantically merge cross-language variants unless they already share the same stable identifier.

## CLI selection

Use `node scripts/run-cli.mjs` for direct CLI calls so they share this skill wrapper's runtime selection. A consumer may configure `TIANGONG_LCA_CLI_INSTALLATION`, `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_FILE` and `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_SHA256` once in its launch environment. These select an already installed and independently qualified CLI through its public runtime API; normal calls need no per-invocation overrides, Git checkout, pnpm or build. Inspect actual identity and selection source with `node scripts/run-cli.mjs --runtime-info`. Invalid configured evidence fails without falling back.

Without an installed selection, execution stops with CLI setup guidance; Skills never downloads or chooses a CLI version. `--cli-dir` is an explicit development-source path. CLI versions and release locks belong to the installation owner, while Skills depend on the public commands and capabilities they use. Continue existing managed tasks through their original owner-returned actions; do not replace their runtime or replay UNKNOWN operations with this standalone entry.
