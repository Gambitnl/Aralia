# Script Tests Decisions

Status: active
Last updated: 2026-06-10

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/script-tests`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Merge into Scripts: Quality

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
The North Star asked whether Script Tests remains a standalone test project or merges into Scripts Quality/Audits before worker assignment (lifecycle status was merge-candidate).

Decision made:
**Merge into Scripts: Quality.** `script-tests` becomes a support surface of `docs/projects/scripts-quality`; this project's status and tracker row become merged-reference. Open gaps ST-GAP-001 through ST-GAP-004 transfer to scripts-quality ownership; the docs in this folder are retained as the reference record of the `scripts/__tests__` continuity contract.

Rationale and evidence:
- The test surface guards the same script-layer quality posture scripts-quality already owns; a standalone project added tracker overhead without a distinct owner.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D21).
- Receiving-side record: `docs/projects/scripts-quality/DECISIONS.md` D2.

Follow-up:
Continue ST-GAP test slices under the scripts-quality tracker; do not assign workers through this project. Expansion-first: nothing in this folder is deleted.
