# History System Decisions

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
- Project folder: `docs/projects/history`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-05`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Bounded Importance-Aware Retention Policy

Date: 2026-06-17

Owner: Cold Start Agent (Iteration 3)

Decision point:
`worldHistory` growth is currently unbounded, risking save size bloat and query performance degradation over long game sessions. We need a retention policy to keep the array bounded while preserving critical lore.

Decision made:
Adopt a "Bounded Importance-Aware Retention" policy:
- **Soft Cap:** 1,000 events.
- **Buffer:** Pruning triggers when the history exceeds 1,100 events.
- **Pruning Logic:** Remove the oldest events with an `importance` score < 80 until the size is back to 1,000.
- **Protection:** Events with `importance >= 80` are protected and never pruned, even if it forces the array to exceed the cap.

Rationale and evidence:
- Aralia save states are JSON/local-storage bound. Unbounded arrays eventually cause serialization lag.
- The 1,000 event cap is generous enough to maintain a rich recent timeline without impacting performance.
- Protecting `importance >= 80` ensures that truly world-changing events (e.g. Major Battles, Catastrophes) are preserved forever.

Follow-up:
Implement this policy in `historyUtils.ts` and ensure the `worldReducer` applies it safely (avoiding a massive sync spike if a legacy save with 5000 events is loaded).
