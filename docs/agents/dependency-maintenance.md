---
title: Skills Dependency Maintenance
docType: guide
scope: repo
status: active
authoritative: false
owner: skills
language: en
whenToUse:
  - when reviewing dependency proposals or monitoring coverage
whenToUpdate:
  - when monitoring or dependency validation changes
checkPaths:
  - .github/dependabot.yml
  - docs/agents/dependency-maintenance.md
lastReviewedAt: 2026-10-16
lastReviewedCommit: dd851cb680d973dc9792c58fadb26a04e9f14d1a
lastReviewedNote: 'Skills #129: Actions monitoring reuses the exact-input four-platform validation; no runtime, skill, launcher or provenance pin changes.'
related:
  - repo-validation.md
---

# Dependency maintenance

Dependabot checks GitHub Actions weekly on Monday at 06:00 Asia/Shanghai, with a
seven-day version cooldown and at most one grouped Actions PR. Existing full
commit references remain integrity-bound. The root package and empty pnpm graph
currently contain no external npm dependencies, so no empty npm updater is added.
Reassess monitoring if owned package dependencies are introduced.

The existing four-platform validation also selects dependency manifests, the
lockfile, monitoring configuration and every Actions workflow. It checks out the
exact candidate with read-only permissions and cancels only superseded PR runs.
The separately pinned public CLI checkout and copied Foundry installation proof
remain unchanged. Ordinary source selection, local frozen install and canonical
`pnpm prepush:gate` retain their current contracts; no additional validation suite
or publication step is introduced.

CLI versions embedded in launchers, the copied Foundry bootstrap/final lock,
public-rule source identities, action inputs and Node/pnpm pins are independently
qualified adoption inputs. Dependabot does not update or qualify those bindings.
Preserve copied bytes, exact release provenance, runtime/write boundaries and
all four native-platform proofs when reviewing an actual proposal.

Verify repository alerts/security-update settings and the first actual updater
run separately from configuration syntax. Inspect candidate CI and update-job
health in the normal weekly queue review; retain failures in the owning Issue.
No scheduled notification service is needed. Before associating a bot proposal,
verify native and independent live merge-service policy, including queued work.
Source protection alone is not deployment evidence. Use the workspace
controller's existing-PR preview and exact-head intake only after that protection
is established. Automatic merging remains off; exact eligible workspace
integration and any runtime adoption stay separate.
