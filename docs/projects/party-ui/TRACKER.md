# Party UI Living Tracker

Status: active
Last updated: 2026-06-24

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
| G7 | done | Thread companion relationship data into `PartyOverlay` as optional roster enrichment. | Gemini | 2026-06-22 | `docs/projects/party-ui/NORTH_STAR.md` G5 contract; `docs/projects/party-ui/GAPS.md` G7 | Closed for implementation; companion relationship level and approval render dynamically. | Verified via PartyPane.test.tsx and GameModals.test.tsx. |
| G9 | done | Add `PartyMemberCard` test coverage. | Gemini | 2026-06-22 | `src/components/Party/PartyPane/PartyMemberCard.tsx` (no tests currently) | Closed for implementation; created PartyMemberCard.test.tsx covering all stats, spell slots, HP bar, missing-choice warnings, companion details, and callbacks. | Verified via PartyMemberCard.test.tsx (9/9 tests pass). |
| G10 | done | Evaluate short rest modal parity with long rest choice flow. | Gemini | 2026-06-22 | `src/components/layout/GameModals.tsx` rest modal mounting | Closed for implementation; wired RestModal under isShortRestModalVisible in GameModals.tsx. | Verified via GameModals.test.tsx and RestModal.test.tsx (4/4 tests pass). |
| G4 | done | Clarify missing-choice warning placement display rule. | Gemini | 2026-06-22 | `docs/projects/party-ui/NORTH_STAR.md` display rule text | Closed for documentation; added display rule text to NORTH_STAR.md and recorded D3 in DECISIONS.md. | Verified via docs consistency check. |
| G6 | done | Audit the impact of central state/save/load modularization on party rest defaults and character reducer assumptions. | Gemini | 2026-06-22 | `docs/projects/party-ui/DECISIONS.md` D4 | Closed for documentation; recorded pipeline pattern, backfill, normalization, and day-tick sync audit findings. | Verified via vitest runs remaining green. |
| G11 | done | Disable Party Overlay rest actions during active combat. | Codex | 2026-06-24 | `src/components/Party/PartyOverlay.tsx`; `src/components/layout/GameModals.tsx`; `src/components/Party/__tests__/PartyOverlay.test.tsx`; `src/components/layout/__tests__/GameModals.test.tsx` | Closed for implementation; active combat now disables Short Rest and Long Rest and shows the combat warning label/tooltip. | Verified via focused PartyOverlay and GameModals vitest runs. |
| G12 | done | Show and route every missing-choice warning on detailed party cards. | Codex | 2026-06-24 | `src/components/Party/PartyPane/PartyMemberCard.tsx`; `src/components/Party/PartyPane/__tests__/PartyMemberCard.test.tsx` | Closed for implementation; detailed cards now render one compact fix action for each missing choice while preserving the portrait summary warning. | Verified via focused PartyMemberCard vitest run. |

## Notes

- Scope anchor: keep edits inside `docs/projects/party-ui/` only.
- Registry status remains in `docs/projects/PROJECT_TRACKER.md` (`Party UI`, partial, `src/components/Party`, gap signal present).
- Current resume target: none registered. G3, G4, G5, G6, G7, G8, G9, G10, G11, and G12 are resolved; run a fresh Party UI expansion sweep before selecting more work in this lane.
- Update 2026-06-19: G5 contract written from D15/D2. Non-companion roster entries are accepted `PlayerCharacter` party members; companion context is optional by id match; save/load preserves party and companion state separately.
- North Star now includes the dashboard card schema, so the next agent should keep that section current instead of recreating it in prose.

## Update Rules

- Update status and next check anytime new implementation detail changes behavior or ownership.
- Keep unresolved non-local contract questions in `GAPS.md` and avoid drifting this tracker into cross-project implementation debt.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
