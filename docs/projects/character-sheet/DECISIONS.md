# Character Sheet Decisions

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
- Project folder: `docs/projects/character-sheet`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Food freshness expiration semantics (G7)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
Should inventory food expiration be computed from a durable acquisition timestamp in the item model, or from an existing authoritative game-date source / deferred lifecycle system? (Required Review Brief in `NORTH_STAR.md`.)

Decision made:
Option A — add durable `acquiredAt` acquisition-timestamp semantics to the item model, backfill/migrate existing inventory data, then implement food expiration from that source.

Rationale and evidence:
- A durable per-item timestamp is the only source that lets `InventoryList.tsx` compute freshness without guessing when food entered inventory.
- Backfill/migration is part of the approved scope so existing saves stay coherent.
- Proof: focused InventoryList render test covering fresh and expired food plus the source-backed model/migration update.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D16).

Follow-up:
Implement the G7 slice: `acquiredAt` field on the item model, inventory backfill/migration, expiration computation in `InventoryList.tsx`, and the focused render test.
