# Party UI Living Tracker

Status: active
Last updated: 2026-06-12

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|

## Notes

- Scope anchor: keep edits inside `docs/projects/party-ui/` only.
- Registry status remains in `docs/projects/PROJECT_TRACKER.md` (`Party UI`, partial, `src/components/Party`, gap signal present).
- Current resume target: G5 remains blocked on human decision; G9 (PartyMemberCard tests), G4 (warning placement rule), and G10 (short rest modal parity) are independent safe lanes; G7 (companion data in overlay) depends on G5. G3 and G8 resolved.
- Update 2026-06-10: G5 decided (Remy, D15 in `docs/projects/DECISION_BLITZ_2026-06-10.md`) â€” roster MAY include non-companion NPCs under an explicit acceptance rule; write the rule (membership model, sheet context, save/load semantics) as step one of the implementation slice, which unblocks G7.
- North Star now includes the dashboard card schema, so the next agent should keep that section current instead of recreating it in prose.

## Update Rules

- Update status and next check anytime new implementation detail changes behavior or ownership.
- Keep unresolved non-local contract questions in `GAPS.md` and avoid drifting this tracker into cross-project implementation debt.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
