# Scripts: Audits North Star

Status: review-required
Last updated: 2026-06-08

## Why This Project Exists

`scripts/audits` is where race image checks, race-sync validation, trait audit
scripts, and portrait QA tooling converge. This project keeps that surface stable,
documented, and recoverable for future maintainers.

## Purpose And Scope

- Keep a working cold-start reference for `scripts/audits`.
- Preserve intent, boundaries, and file map for audit workflows tied to races.
- Track integration points with portrait regeneration and glossary/race sync flow.

## Dashboard Card Schema

Project: Scripts: Audits
Slug: scripts-audits
Category: Tools, Automation, and Infrastructure
Status: review-required
Confidence: medium
Evidence: docs/projects/scripts-audits
Gap signal: 4 open gaps in GAPS.md, including 1 blocked_human_decision
Protocol: living project doc set
Next step: Human/policy decision: decide which audits are mandatory gates versus optional/manual checks before assigning forward automation work.
Required verification: docs_consistency, scoped_checks
Completed verification: docs_consistency
Last proof: 2026-06-08 review-gate classification
Workflow gaps reviewed: 2026-06-08

Dashboard lifecycle: policy-review-required
Assignment rule: Do not assign forward iteration agents until mandatory-vs-optional audit policy is decided.

## File Map

- `scripts/audits/*.ts` - audit and workflow scripts.
- `scripts/audits/*.py` - image/asset quality helpers.
- `scripts/audits/qa-batches/*` - generated QA inputs, prompts, schema, and outputs.
- `scripts/audits/*.{json,md}` - machine and human-readable state reports.

## Implemented State

- Registry evidence is present:
  - `docs/projects/PROJECT_TRACKER.md` row: `Scripts: audits` with GAPS file present.
- Core audit scripts and outputs already exist in place:
  - `scripts/audits/check-base-trait-coverage.ts`
  - `scripts/audits/check-base-trait-key-coverage.ts`
  - `scripts/audits/audit-race-image-bytes.ts`
  - `scripts/audits/verify-cc-glossary-race-sync.ts`
  - `scripts/audits/audit-race-ids-vs-glossary.ts`
  - `scripts/audits/racialSpellParserAudit.ts`
  - `scripts/audits/trait_analyzer.ts`
  - `scripts/audits/list-slice-of-life-settings.ts`
  - `scripts/audits/mark-slice-of-life-qa.ts`
  - `scripts/audits/orchestrate-race-qa.ts`
  - `scripts/audits/run-qa-batch-agent.ts`
  - `scripts/audits/list-base-race-chooser-candidates.ts`
  - `scripts/audits/inventory-glossary-link-surfaces.ts`
- Image and backlog helpers are also present:
  - `scripts/audits/detect-blank-margins.py`
  - `scripts/audits/check-image-square.py`
  - `scripts/audits/list-non-square-race-images.py`
  - `scripts/audits/race-status-tail.py`
  - `scripts/audits/list-backlog-progress.py`
- Current generated report set includes:
  - `scripts/audits/base-trait-coverage.report.json`
  - `scripts/audits/base-trait-key-coverage.report.json`
  - `scripts/audits/race-image-byte-audit.json`
  - `scripts/audits/slice-of-life-settings.json` and `slice-of-life-settings.md`
  - `scripts/audits/slice-of-life-qa.json`

## Current State

- The project docs are now dashboard-ready: the North Star has a card schema,
  the tracker is aligned to the durable gap list, and the cold-start handoff
  names the canonical protocol paths.
- Live command and report validation is still pending in T2, but forward automation/gating work is blocked by S4 policy review.
- The shared workflow path mismatch is already tracked centrally in
  `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` as
  WFG-001.

## Integrations

- `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`:
  - `npm run audit:races`
  - `npx tsx scripts/audits/verify-cc-glossary-race-sync.ts`
- `docs/portraits/race_portrait_regen_handoff.md`:
  - `scripts/audits/list-slice-of-life-settings.ts`
  - `scripts/audits/mark-slice-of-life-qa.ts`
  - `scripts/audits/orchestrate-race-qa.ts`
  - `scripts/audits/run-qa-batch-agent.ts`
  - `scripts/audits/qa-batches/QA_RUBRIC.md`
- `scripts/run-portrait-regen.cmd`:
  - `npx tsx scripts/audits/list-slice-of-life-settings.ts`
- Output consumers:
  - `public/data/dev/slice-of-life-settings.json/.md`
  - `docs/portraits/race_portrait_regen_backlog.json`
  - `public/assets/images/races/race-image-status.json`

## Active Task

| Field | Value |
|---|---|
| Task | Keep the docs aligned with the current scripts/audits surface and unresolved check gaps |
| Acceptance criteria | NORTH_STAR, TRACKER, and GAPS stay compact, current, and point the next agent at the live command/report paths |
| Allowed boundaries | `docs/projects/scripts-audits/*` |
| Stop condition | Next maintainer can resume immediately from this docs set |
| Verification | docs consistency review completed; live path validation remains the next check |
| Owner | scripts-audits maintainer |

## Open Questions

- Which checks should be the canonical local entrypoint versus standalone commands?
- What freshness threshold makes generated reports safe to treat as current evidence?
- Should the CI/manual policy decision stay project-local or be routed to a broader workflow note?

## Next Checks

1) `npx tsx scripts/audits/audit-race-image-bytes.ts`
2) `npx tsx scripts/audits/verify-cc-glossary-race-sync.ts`
3) `npx tsx scripts/audits/list-slice-of-life-settings.ts`
4) `python scripts/audits/race-status-tail.py --n 20`
5) Compare the command and report paths named in this file against the live docs tree and the current `scripts/audits` outputs.

## Resume Path

1. Read this file.
2. Read `docs/projects/scripts-audits/TRACKER.md`.
3. Read `docs/projects/scripts-audits/GAPS.md`.
4. Re-run the "Next Checks" list and update `TRACKER.md`.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
