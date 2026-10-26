---
name: process-dedup-review
description: "Review grouped TianGong process duplicate candidates from JSON snapshots, recommend which duplicate rows to keep or delete, and write reproducible evidence outputs plus follow-up notes. Use when identical exchange fingerprints suggest duplicate process drafts and you need a repeatable process dedup review workflow."
---

# process-dedup-review

Use this skill when the input is grouped JSON listing suspected duplicate `process` rows, especially groups generated from identical exchange fingerprints.

## Workflow

1. Create an output directory such as `artifacts/<case_slug>/`.
2. Freeze the grouped JSON input under `inputs/`.
3. Run the bundled wrapper:

```bash
node process-dedup-review/scripts/run-process-dedup-review.mjs \
  --input /abs/path/duplicate-groups.json \
  --out-dir /abs/path/artifacts/<case_slug> \
  --json
```

4. Read `outputs/duplicate-groups.json` and `outputs/delete-plan.json`.
5. Apply the decision rules in `references/review-rules.md`.
6. Write the review report and required summary/verification reports, and explicitly note any unresolved limitations in the review artifacts.

The wrapper delegates to the canonical CLI command:

```bash
tiangong-lca process dedup-review --input /abs/path/duplicate-groups.json --out-dir /abs/path/artifacts/<case_slug>
```

## Canonical Input Contract

```json
{
  "source_label": "duplicate-processes-export",
  "groups": [
    {
      "group_id": 1,
      "processes": [
        {
          "process_id": "proc-1",
          "version": "01.00.000",
          "name_en": "Example process",
          "name_zh": "示例过程",
          "sheet_exchange_rows": [
            {
              "flow_id": "flow-1",
              "direction": "Input",
              "mean_amount": "1",
              "resulting_amount": "1"
            }
          ]
        }
      ]
    }
  ]
}
```

If the source begins as a spreadsheet, convert it into grouped JSON before using this skill. The skill no longer ships a workbook parser, because the default form must remain a thin CLI wrapper.

## Remote Enrichment

- If `TIANGONG_LCA_API_BASE_URL`, `TIANGONG_LCA_SUPABASE_PUBLISHABLE_KEY`, and `TIANGONG_LCA_OAUTH_CLIENT_ID` are available, run `tiangong-lca auth status --json`; the CLI then enriches each candidate with:
  - `state_code`
  - `created_at`
  - `modified_at`
  - remote exchange flow short descriptions
  - reference scan results within the authenticated user's accessible scope across `processes` and `lifecyclemodels`
- The CLI loads `.env` from the current working directory before reading `TIANGONG_LCA_*`.
- If status is `login-required`, stop and ask the human to run `auth login` in a trusted terminal. Never request a password, code, token, or legacy API key. Use a separate private session file per account; headless tokens may come only from an approved orchestrator and never enter argv or artifacts.
- If remote enrichment fails, continue with local grouped-JSON evidence and note the limitation in the review output.

## Canonical Outputs

- `inputs/dedup-input.manifest.json`
- `inputs/processes.remote-metadata.json` when remote enrichment succeeds
- `outputs/duplicate-groups.json`
- `outputs/delete-plan.json`

## Decision Boundary

- Treat a group as an exact duplicate only when the normalized exchange multiset is identical after ignoring exchange row order and exchange internal IDs.
- Keep/delete is a review recommendation, not an automatic remote delete.
- If you cannot verify downstream references, label the delete list as `priority delete candidates` rather than claiming the rows are globally safe to remove.
- If the upstream identity workflow returned `block_duplicate`, preserve that decision as the reason to reuse an existing row instead of creating another process.
- If any group requires semantic judgment beyond exact exchange equality, mark it `manual_review` in the handoff and stop autonomous delete planning for that group.
- Do not convert `delete-plan.json` into remote mutation without a separate CLI-backed write command, dry-run artifact, and post-write verification.

## Required Handoff Artifacts

- Input artifact: grouped duplicate-process JSON.
- CLI output artifacts: `inputs/dedup-input.manifest.json`, optional `inputs/processes.remote-metadata.json`, `outputs/duplicate-groups.json`, and `outputs/delete-plan.json`.
- Review output: a concise report that states exact duplicate evidence, chosen keeper, reference-verification coverage, and whether each delete candidate is safe or only prioritized for manual review.

## Load On Demand

- Read `references/review-rules.md` for the evidence hierarchy and keep/delete tie-break rules.

## CLI selection

Use `node scripts/run-cli.mjs` for direct CLI calls so they share this skill wrapper's runtime selection. A consumer may configure `TIANGONG_LCA_CLI_INSTALLATION`, `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_FILE` and `TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_SHA256` once in its launch environment. These select an already installed and independently qualified CLI through its public runtime API; normal calls need no per-invocation overrides, Git checkout, pnpm or build. Inspect actual identity and selection source with `node scripts/run-cli.mjs --runtime-info`. Invalid configured evidence fails without falling back.

Without an installed selection, the standalone distribution default remains pinned. `--cli-dir` is an explicit development-source path; `--published-cli` explicitly selects the distribution default. Continue existing managed tasks through their original owner-returned actions; do not replace their runtime or replay UNKNOWN operations with this standalone entry.
