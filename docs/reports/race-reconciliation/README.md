# Race Reconciliation Workflow

This folder contains generated reports that compare Aralia's implemented race data against the vendored 5etools race corpus.

The workflow is intentionally report-driven. It does not overwrite Aralia race files, bulk-convert vendor data, or remove glossary/display scaffolding.

## How To Run

```bash
npx tsx scripts/raceReconciliationInventory.ts
```

## Inputs

- `src/data/races/*.ts`: current Aralia race mechanics and descriptions.
- `public/data/glossary/entries/races/**/*.json`: race glossary/display entries.
- `vendor/5etools-src/data/races.json`: local 5etools race reference corpus.
- `vendor/5etools-src/data/foundry-races.json`: optional foundry supplement signals when present.

## Outputs

- `aralia-race-inventory.json`: implemented Aralia race records and safe structural warnings.
- `vendor-race-inventory.json`: summarized vendor race records with source/path references and short trait labels.
- `aralia-to-vendor-crosswalk.json`: candidate matches with confidence, scores, reasons, and review notes.
- `mechanics-support-report.json`: per-race/per-trait support bucket classifications.
- `aralia-mechanic-capability-matrix.json`: machine-readable support claims with code references.
- `aralia-mechanic-capability-matrix.md`: human-readable support claims with limitations.
- `implemented-race-mechanics.md`: details classified as enforced by current Aralia systems.
- `unresolved-race-mechanics.md`: blocked or ambiguous details grouped by missing family.
- `reconciliation-quality-notes.md`: known classifier repairs and remaining weak spots.
- `mechanic-buckets.md`: mechanics grouped by status and reusable family.
- `reconciliation-summary.md`: executive summary, uncertainty notes, preserved intent, and recommended next prompt.

## How To Interpret Confidence

- `high`: deterministic name or ID match plus supporting mechanical overlap such as speed, darkvision, or trait names.
- `medium`: useful candidate, but not enough evidence for automated migration.
- `low`: weak candidate retained for human review.

## Support Buckets

- `enforced_now`: Aralia has a concrete code path that consumes this mechanic.
- `represented_not_enforced`: Aralia stores or validates part of the mechanic, but gameplay does not fully consume it.
- `blocked_by_missing_mechanic_family`: repeated mechanic that needs a reusable system before migration.
- `ambiguous_requires_human_mapping`: unclear behavior or mapping that needs review.
- `display_lore_only`: useful descriptive material without current gameplay enforcement.

## Progress Log

- Discovery confirmed existing race sync tooling and the vendor corpus path.
- The workflow generates all reports locally from current repo data.
- Focused validation commands and any blockers should be recorded in `reconciliation-summary.md` by the agent running the workflow.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/reports/race-reconciliation/README.md","sha256WithoutMarker":"ad6d05490292b138f38e721d585476eaea8d02c85039f29efff6302671a984b2","markedAtUtc":"2026-06-26T00:26:22.314Z"} -->
