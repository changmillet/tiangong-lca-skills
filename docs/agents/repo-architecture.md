---
title: skills Repo Architecture
docType: reference
scope: repo
status: active
authoritative: true
owner: skills
language: en
whenToUse:
  - when deciding whether a change belongs in the skills repository or the CLI repository
  - when changing checked-in skill instructions, wrappers, references, assets, or validation rules
whenToUpdate:
  - when skill package structure changes
  - when the CLI boundary changes
  - when skill validation or packaging ownership changes
checkPaths:
  - .claude-plugin/marketplace.json
  - .gitattributes
  - AGENTS.md
  - .docpact/config.yaml
  - "*/SKILL.md"
  - "*/agents/openai.yaml"
  - "*/scripts/**"
  - "*/references/**"
  - "*/assets/**"
  - .githooks/pre-push
  - scripts/docpact
  - scripts/docpact-gate.sh
  - scripts/install-git-hooks.sh
  - scripts/check-toolchain.mjs
  - scripts/lib/cli-launcher.mjs
  - scripts/sync-tidas-public-rules.mjs
  - package.json
  - pnpm-lock.yaml
lastReviewedAt: 2026-09-24
lastReviewedCommit: ef352e56386de268aa63edeece0d9059c5f30355
lastReviewedNote: 'Reviewed Skills #118 interaction guidance and the read-only qualification versus data#33 repair boundary; package ownership and CLI boundary are unchanged.'
related:
  - AGENTS.md
  - .docpact/config.yaml
  - docs/agents/repo-validation.md
---

# skills Repo Architecture

`tiangong-lca/agent-skills` owns checked-in skill packages and CLI-backed agent workflow wrappers for TianGong workflows.

## Owned Surfaces

- `*/SKILL.md` contains canonical skill instructions and trigger contracts.
- `*/agents/openai.yaml` contains wrapper contracts used by the skills CLI.
- `*/scripts/**`, `*/references/**`, and `*/assets/**` are skill-local support files intentionally shipped with a skill package.
- `scripts/validate-skills.mjs` and `test/**` define repo-level validation for wrappers and packaging rules.
- `scripts/sync-tidas-public-rules.mjs` binds the selected skill-local public-rule copies to one exact published `tidas-spec` source/version/hash; package-local readers fail closed on altered assets or overrides.
- `package.json` and `pnpm-lock.yaml` pin the validation-only Node `24.19.0` / pnpm `11.24.0` package contract; this does not turn the skill packages into a TypeScript runtime.
- `scripts/lib/cli-launcher.mjs` owns exact local/published CLI selection, package evidence checks, frozen local preparation, and argv-only process dispatch.
- `README.md` and `README.zh-CN.md` explain installation and usage.
- `.claude-plugin/marketplace.json` groups the existing skill packages for discovery. Its Foundry group lists the ordinary entry first, the on-demand authoring role, and the retained specialized workflows.

Top-level Foundry scenario skills are allowed in this repository when they only encode workflow order and routing:

- `external-dataset-curated-import`
- `source-evidence-dataset-development`

## Non-Owner Boundaries

- `tiangong-lca/cli` owns the native public command surface, low-level command semantics, REST clients, and auth behavior.
- External source-evidence research skill repositories, such as `tiangong-ai/skills`, own fast-moving Tiangong KB retrieval skills.
- Product/runtime repositories own business logic and API behavior.
- `lca-workspace` owns root integration state and submodule pointer updates.

If a skill needs a capability that does not exist in the CLI, add the capability to `tiangong-lca/cli` first and keep the skill as a thin wrapper over that CLI surface.

Remote authentication follows the same boundary. Skills may invoke `auth status`, instruct a human to run browser `auth login`, and require live redacted `doctor-auth`, but they never inspect session files or handle passwords, codes, or tokens. Explicit headless and multi-account configuration remain CLI/orchestrator responsibilities. The validator rejects password-equivalent invocation examples in active Markdown.

Official Production's public profile is owned and bundled by the CLI, not copied into Skills. A first install needs human browser login, not dashboard/client-ID setup. Complete custom environments and explicitly targeted headless tokens remain separate. The flow/process/lifecyclemodel hybrid-search packages bundle the root launcher byte-for-byte at their own `scripts/lib/cli-launcher.mjs` so copied individual installations do not import outside their package. The installed-consumer test checks bundle equality, a real published-CLI dry-run, no local checkout/session creation, and rejection of incomplete custom destinations.

If a Foundry/source-evidence workflow needs an external Tiangong KB research skill, consume it with `npx skills` at runtime and record the resolved upstream ref in the task workspace. Do not copy the external skill package into this repository unless ownership is intentionally transferred.

Current-account dataset review is owned here only as a skill package and wrapper contract. Its durable runtime behavior belongs in public `tiangong-lca` CLI commands such as dataset validation, reference rewriting, lifecyclemodel save-draft, and lifecyclemodel graph export.

The shared wrapper launcher defaults to pinned published `@tiangong-lca/cli@0.1.20` and never discovers sibling directories. CI checks out canonical `tiangong-lca/cli` at release merge `c498906a13fa345eebebbadc87e3a773abb1be6a`, which carries package version 0.1.20 and the source-bound TIDAS manifest for spec `8a9470a7dd4c074ae246bb9967b3bfae3e371e32` (0.2.2) and semantic source `9c0d8b1c8ceb1841074f5bc6de5fbb7fcc9318f5`. An explicit `--cli-dir` or `TIANGONG_LCA_CLI_DIR` may select an exact matching local checkout; only after package/engine/lock/source-manifest evidence passes may the launcher prepare it with `pnpm install --frozen-lockfile` and `pnpm run build` when source files are newer than `dist/src/main.js`. All execution stays argv-authoritative with `shell: false`, using native `pnpm.exe` on Windows. This is a developer-experience guard for stale local checkouts, not permission for skills to duplicate CLI implementation.

Public rules are spec-owned; runtime-ruleset profile projection is CLI-owned. Published SDK 0.3.0 has retired the legacy mixed-file static import; active CLI 0.1.20 consumes the public contract API.

## Integration Semantics

A merged PR in this repository is repo-complete only. If the updated skill set must ship through the workspace, root integration must deliberately update the `tiangong-lca/agent-skills` submodule pointer after merge.

## Local Docpact Push Gate

This repository has a versioned local `pre-push` hook under `.githooks/pre-push` that delegates to `scripts/docpact-gate.sh`, resolves the docpact CLI through `scripts/docpact`, installs Skills through its frozen pnpm lockfile, and defaults validation to the published CLI. It installs/builds a local CLI only when explicitly selected and only after launcher-owned package evidence validation. The hook then runs `pnpm prepush:gate`; it is the local guard for docpact config validation, enforced doc-governance linting, toolchain tests, and skill validation. The GitHub `validate-skills` workflow runs for Foundry package/test pull requests and manual dispatch.

The internal `foundry-tidas-authoring` package is data-only guidance over an existing Foundry work item. Its local semantic reference is self-contained; execution, artifact registration, current authorization and readback remain Foundry/CLI responsibilities. The original workflow skill purposes remain separate.

`foundry-tidas-import` owns ordinary task instructions for both packaged imports and source-evidence development. Its self-contained public workflow reference describes task/semantic selection and current-action consumption; it carries no state machine or database logic. A missing internal authoring skill can be handled from the runtime-generated work item and template without a sibling-directory dependency. The distributed final lock selects the independently qualified Foundry 0.1.8 release, and the marketplace lists this complete entry first.

The Foundry entry distributes byte-identical POSIX/PowerShell bootstrap scripts from the historical CLI `cli-v0.1.14` commit `bcc5dbee5b909dbb912e09d99ca07e858d3d7cec`. Skills owns their packaging, not their implementation. Path-specific Git attributes prevent checkout newline conversion for both scripts, the retained license and the adjacent final lock. The original scripts select only their adjacent lock; the adjacent final lock is copied byte-for-byte from independently qualified `foundry-runtime-v0.1.10`. Its manifest SHA-256 is `a429da4903c7f05ecc26130eda03cf55100461f556622c311f9f73d377b6b615`, binding Foundry source `1e4f48bf8359f5e9bacba5741d15b7ff78f2eb41`, Node 24.19.0, the Foundry owner's bundled CLI 0.1.19 (tag `cli-v0.1.19`, commit `7f7b313cebc30c96154860df30f5d666963bc0b7`) and TIDAS 0.3.2. This package is intentionally independent from the shared wrapper's current CLI 0.1.20: the two owner versions are never conflated, and the independently copied package test verifies the public installed runtime, its warm start and its returned-action resume against that source and content identity.

The independently copied Foundry entry retains the original C1 copyright/license text at `assets/licenses/tiangong-cli-LICENSE` beside its bundled scripts. Its bytes are checked with the script pins; this adds no user-facing license command or confirmation flow.

The ordinary entry may use a copied source record to demonstrate a current runtime's interaction behavior without changing that record. For Skills #118, the credential-free synthetic Process fixture is preparatory while the distributed lock stays at 0.1.10; it and the planned read-only mine-water case become qualification evidence only when run against the exact successor release. The actual mine-water XML repair is owned by `tiangong-lca/data#33`, with its own scientific evidence, review and workspace integration; this skill package cannot make that data delivery complete. User answers such as “暂不确定，先调查” stay unresolved investigation requests until a supported source or an explicit decision closes the gap.

The retained `external-dataset-curated-import` and `source-evidence-dataset-development` skills support independent CLI workflows. Within a registered public Foundry task they act as domain helpers over current work items and supplied actions; they return selected input files and cannot manually advance queues, checkpoints, registered artifacts or attempts. Their paired agent prompts preserve this boundary.
