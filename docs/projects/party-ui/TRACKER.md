# Party UI Tracker

Status: active
Last updated: 2026-06-08

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
- North Star now includes the dashboard card schema, so the next agent should keep that section current instead of recreating it in prose.

## Update Rules

- Update status and next check anytime new implementation detail changes behavior or ownership.
- Keep unresolved non-local contract questions in `GAPS.md` and avoid drifting this tracker into cross-project implementation debt.
