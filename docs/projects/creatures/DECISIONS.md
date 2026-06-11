# Creatures System Decisions

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
- Project folder: `docs/projects/creatures`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-09`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Hybrid/multi-type creature semantics — keep binary, defer hybrid (G4)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
The G4 Required Review Brief asked whether creature targeting should stay on the current binary include/exclude contract (Option A) or define and implement a canonical hybrid semantics model now (Option B).

Decision made:
Option A — **keep the binary include/exclude contract and explicitly defer hybrid semantics** to a later product/schema decision. This cycle's closure is docs-only: no taxonomy, validator, or schema changes.

Rationale and evidence:
- The dominance/partial-effect model in `src/systems/creatures/Creatures_Ralph.md` has no approved schema, and implementing it would force validation, migration, and test changes without product need this cycle.
- The June 2026 campaign's entity generation pipeline may inform the eventual hybrid model when that later decision is taken.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D11).
- Brief and gap: `docs/projects/creatures/NORTH_STAR.md` Required Review Brief; `docs/projects/creatures/GAPS.md` G4.

Follow-up:
None this cycle. Any future hybrid/multi-type work starts with a fresh product/schema decision rather than reopening G4; `CreatureTaxonomy.isValidTarget` binary semantics remain canonical until then.
