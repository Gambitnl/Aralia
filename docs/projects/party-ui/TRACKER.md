# Party UI Living Tracker

Status: active
Last updated: 2026-06-10

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
| T1 | done | Reframe Party UI project docs as implementation-state snapshot | Worker B | 2026-05-31 | `docs/projects/party-ui/NORTH_STAR.md` | Keep runtime and companion boundaries aligned in docs | `src/components/Party`, `src/hooks/actions`, `src/state` references are now mapped |
| T2 | done | Preserve/define companion-party membership boundary | Worker B | 2026-06-08 | `src/components/Party/RelationshipsPane.tsx`, `src/components/layout/GameModals.tsx`, `src/types/companions.ts`, `src/components/CharacterSheet/CharacterSheetModal.tsx`, `src/components/Party/PartyOverlay.tsx` | Canonical rule documented in NORTH_STAR; G1 closed; G7/G8 registered | Rule is separate identity spaces + best-effort id bridge; no recruitment logic exists |
| T3 | done | Verify integration checks for rest and tracker persistence | Worker B | 2026-06-08 | `src/hooks/actions/handleResourceActions.ts`, `src/state/reducers/worldReducer.ts`, `src/state/initialState.ts`, `src/state/appState.ts`, `src/state/reducers/__tests__/worldReducer.test.ts`, `src/state/__tests__/worldViewModeLegacy3d.test.ts` | Follow-up: validate companion context survives `SET_FULL_PARTY` rebuild | Confirm `shortRestTracker` persistence and day reset after ADVANCE_TIME; companion-id coherence after rebuild (G8) |
| T4 | done | Validate docs-only scope | Worker B | 2026-05-31 | `docs/projects/party-ui/NORTH_STAR.md`, `docs/projects/party-ui/GAPS.md` | No additional docs outside `docs/projects/party-ui/` for this request | Confirmed no edits outside target directory |
| T5 | done | Validate companion context through party rebuild flows | Qoder | 2026-06-08 | `src/components/layout/__tests__/GameModals.test.tsx`, `src/components/layout/GameModals.tsx`, `src/state/reducers/characterReducer.ts`, `src/utils/character/characterUtils.ts` (line 615: `id: tempMember.id`), `src/components/Party/PartyEditorModal.tsx` | Confirmed companion prop survives id-preserving `SET_FULL_PARTY` and `SET_PARTY_COMPOSITION` rebuilds; mismatch warning resolved as not-needed per canonical design (separate identity spaces, best-effort id bridge); G8 closed | Companion context lookup regression proof for both rebuild paths green (17/17 tests pass); `createPlayerCharacterFromTemp` preserves id; silent null for non-matching ids is a design choice, not a bug |
| G3 | done | Align README artifacts under `src/components/Party/*` with current behavior | Qoder | 2026-06-08 | `src/components/Party/PartyOverlay.README.md`, `src/components/Party/PartyPane.README.md`, `src/components/Party/PartyOverlay.tsx`, `src/components/Party/PartyPane/PartyPane.tsx`, `src/components/Party/PartyPane/PartyMemberCard.tsx`, `src/components/layout/GameModals.tsx` | Rewrote both READMEs to match current implementation; confirmed `PartyPane/PartyPane.README.md` does not exist (covered by parent README) | Props, integration, sub-components, and rest footer all documented accurately; 17/17 scoped tests pass |

## Notes

- Scope anchor: keep edits inside `docs/projects/party-ui/` only.
- Registry status remains in `docs/projects/PROJECT_TRACKER.md` (`Party UI`, partial, `src/components/Party`, gap signal present).
- Current resume target: G5 remains blocked on human decision; G9 (PartyMemberCard tests), G4 (warning placement rule), and G10 (short rest modal parity) are independent safe lanes; G7 (companion data in overlay) depends on G5. G3 and G8 resolved.
- Update 2026-06-10: G5 decided (Remy, D15 in `docs/projects/DECISION_BLITZ_2026-06-10.md`) — roster MAY include non-companion NPCs under an explicit acceptance rule; write the rule (membership model, sheet context, save/load semantics) as step one of the implementation slice, which unblocks G7.
- North Star now includes the dashboard card schema, so the next agent should keep that section current instead of recreating it in prose.

## Update Rules

- Update status and next check anytime new implementation detail changes behavior or ownership.
- Keep unresolved non-local contract questions in `GAPS.md` and avoid drifting this tracker into cross-project implementation debt.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |
