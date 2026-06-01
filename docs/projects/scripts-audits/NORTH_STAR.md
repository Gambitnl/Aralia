# Scripts: Audits North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

`scripts/audits` is where race image checks, race-sync validation, trait audit
scripts, and portrait QA tooling converge. This project keeps that surface stable,
documented, and recoverable for future maintainers.

## Purpose And Scope

- Keep a working cold-start reference for `scripts/audits`.
- Preserve intent, boundaries, and file map for audit workflows tied to races.
- Track integration points with portrait regeneration and glossary/race sync flow.

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
| Task | Keep project docs aligned with the current scripts/audits surface and unresolved check gaps |
| Acceptance criteria | NORTH_STAR, TRACKER, and GAPS capture purpose, scope, integrations, concrete gaps, and next checks |
| Allowed boundaries | `docs/projects/scripts-audits/*` |
| Stop condition | Next maintainer can resume immediately from this docs set |
| Verification | all referenced paths exist and commands are reproducible from this doc |
| Owner | scripts-audits maintainer |

## Open Questions

- Which of these audits should be mandatory in CI versus local-only?
- What minimum frequency is required for regenerating stale outputs such as
  `slice-of-life-settings.json` and `slice-of-life-qa.json`?
- Which gaps from historical QA output should be promoted to local policy actions and which should remain advisory?

## Next Checks

1) `npx tsx scripts/audits/audit-race-image-bytes.ts`
2) `npx tsx scripts/audits/verify-cc-glossary-race-sync.ts`
3) `npx tsx scripts/audits/list-slice-of-life-settings.ts`
4) `python scripts/audits/race-status-tail.py --n 20`
5) Quick scan for missing report outputs in `scripts/audits` and compare with references in `docs/portraits/race_portrait_regen_handoff.md`

## Resume Path

1. Read this file.
2. Read `docs/projects/scripts-audits/TRACKER.md`.
3. Read `docs/projects/scripts-audits/GAPS.md`.
4. Re-run the "Next Checks" list and update `TRACKER.md`.
