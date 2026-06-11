# Character Creator Decisions

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
- Project folder: `docs/projects/character-creator`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Housekeeping — G2 sidebar navigation policy was already resolved 2026-06-08

Date: 2026-06-10

Owner: Remy (project owner), batched decision session (housekeeping confirmation, not a new decision)

Decision point:
The 2026-06-10 decision blitz reviewed every pending review hold across `docs/projects/*`. Character Creator's G2 (sidebar navigation policy) still read as a review hold in some status fields.

Decision made:
No new decision was needed: G2 was already resolved on 2026-06-08 — permissive sidebar navigation with locked placeholders is the intentional design (`StepLockedPlaceholder` exists to avoid the dispatch-during-render anti-pattern). The project docs were updated so they no longer present G2 as a pending review hold; the historical Required Review Brief and resolution text are preserved unchanged.

Rationale and evidence:
- `docs/projects/character-creator/NORTH_STAR.md` Required Review Brief already carried "Status: Resolved - Permissive Navigation Intentional" with decision owner recorded 2026-06-08.
- `GAPS.md` G2 and `TRACKER.md` T3/G2 were already `done`/`decision_recorded`.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` ("Items converted to work" — Character Creator G2 row: "Already resolved 2026-06-08 (permissive navigation). No action; tracker row should drop the review hold").

Follow-up:
None for G2. Open lanes remain T4 (doc drift reconciliation) and gaps G1, G3-G8.
