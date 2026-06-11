# Logbook Decisions

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
- Project folder: `docs/projects/logbook`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-05`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Discovery log retention policy slice design

Date: 2026-06-10

Owner: iteration 2 agent

Decision point:
G1 requires a retention policy for `discoveryLog`. The implementation slice must be defined before code changes.

Decision made:
Use a simple cap model: add `MAX_DISCOVERY_LOG_ENTRIES` (recommended 200), slice the array after prepend in `ADD_DISCOVERY_ENTRY`, count pruned unread entries and subtract from `unreadDiscoveryCount`, and add load-time prune in `saveLoadService` for old saves that exceed the cap.

Open sub-decision: whether quest-related entries (`isQuestRelated: true`) should be exempt from pruning. Deferred to implementation time.

Rationale and evidence:
- Other log systems in the same reducer already use `.slice(0, N)` caps (gemini: 100, banter: 50, combat: 50).
- `saveLoadService` already initializes missing fields on load, making it a natural prune point.
- A cap of 200 balances long play sessions against save data size.

Follow-up:
Implement in T3. If the quest-exemption question blocks implementation, record it as a `blocked_human_decision` gap.
