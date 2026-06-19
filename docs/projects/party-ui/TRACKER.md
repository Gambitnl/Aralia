# Party UI Living Tracker

Status: active
Last updated: 2026-06-19

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
|---|---|---|---|---|---|---|---|
| G5 | done | Write the roster acceptance rule for non-companion NPCs as the required D15/D2 contract. | Codex | 2026-06-19 | `docs/projects/DECISION_BLITZ_2026-06-10.md` D15; `docs/projects/party-ui/DECISIONS.md` D2; `docs/projects/party-ui/NORTH_STAR.md` "Roster acceptance rule for non-companion NPCs" | Closed for docs contract; preserve rule when implementing G7. | Living project docs audit attempted; GAPS.md marks G5 resolved. |
| G7 | not_started | Thread companion relationship data into `PartyOverlay` as optional roster enrichment. | Codex | 2026-06-19 | `docs/projects/party-ui/NORTH_STAR.md` G5 contract; `docs/projects/party-ui/GAPS.md` G7 | Add optional companion data at the overlay boundary and render relationship context only when a party member id matches `gameState.companions`. | Visual check plus focused companion/non-companion regression proof after code changes. |

## Notes

- Scope anchor: keep edits inside `docs/projects/party-ui/` only.
- Registry status remains in `docs/projects/PROJECT_TRACKER.md` (`Party UI`, partial, `src/components/Party`, gap signal present).
- Current resume target: G7 is now unblocked by the written G5 acceptance contract; G9 (PartyMemberCard tests), G4 (warning placement rule), and G10 (short rest modal parity) remain independent safe lanes. G3, G5, and G8 are resolved.
- Update 2026-06-19: G5 contract written from D15/D2. Non-companion roster entries are accepted `PlayerCharacter` party members; companion context is optional by id match; save/load preserves party and companion state separately.
- North Star now includes the dashboard card schema, so the next agent should keep that section current instead of recreating it in prose.

## Update Rules

- Update status and next check anytime new implementation detail changes behavior or ownership.
- Keep unresolved non-local contract questions in `GAPS.md` and avoid drifting this tracker into cross-project implementation debt.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
