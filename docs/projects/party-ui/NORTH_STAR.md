# Party UI North Star

Status: active
Last updated: 2026-06-08

## Dashboard Card Schema

Project: Party UI
Slug: party-ui
Category: Feature/UI Projects
Status: partial
Confidence: medium
Evidence: docs/projects/party-ui
Gap signal: 5 open gaps (G3 resolved 2026-06-08; G5 blocked on human decision; G9/G10 registered 2026-06-08; G7 depends on G5)
Protocol: living project doc set
Next step: G5 (roster acceptance rule) blocked on human decision; G7 (companion data in overlay) next safe lane once G5 is decided; G9 (PartyMemberCard tests) and G4 (warning placement rule) are independent tasks.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency, focused short-rest persistence tests, companion-context regression tests (2026-06-08), T5 mismatch-warning evaluation (2026-06-08), G3 README audit (2026-06-08)
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

## Purpose and scope

Party UI is implemented as a playable surface for:

- opening the party roster overlay from gameplay
- opening character sheets from the roster
- resolving short rest and long rest actions from roster controls
- showing missing-choice warnings and fix flow entry
- dev-only party editing, including full premade character replacement

This is a cold-start implementation snapshot, not a scaffold placeholder.

## What is live now

- `src/components/Party/PartyOverlay.tsx` is the overlay entry view with party cards and rest footer.
- `src/components/Party/PartyPane/PartyPane.tsx` renders `gameState.party` as a member list.
- `src/components/Party/PartyPane/PartyMemberCard.tsx` and `PartyCharacterButton.tsx` render member stats, HP bars, missing-choice warnings, and open sheet callbacks.
- `src/components/Party/PartyEditorModal.tsx` is a dev tool that edits `TempPartyMember[]` and can save as full character arrays.
- `src/components/Party/RelationshipsPane.tsx` displays companion relationships from `gameState.companions`.
- `src/components/layout/GameModals.tsx` is the host that mounts `PartyOverlay`, `PartyEditorModal`, and `CharacterSheetModal`.

## File map (direct pointers)

### UI and integration
- `src/components/Party/PartyOverlay.tsx`
- `src/components/Party/PartyPane/index.ts`
- `src/components/Party/PartyPane/PartyPane.tsx`
- `src/components/Party/PartyPane/PartyMemberCard.tsx`
- `src/components/Party/PartyPane/PartyCharacterButton.tsx`
- `src/components/Party/PartyEditorModal.tsx`
- `src/components/Party/RelationshipsPane.tsx`
- `src/components/EncounterGenerator/PartyManager.tsx`
- `src/components/layout/GameModals.tsx`
- `src/components/ActionPane/SystemMenu.tsx`

### State, action, and handlers
- `src/types/actions.ts`
- `src/types/actions.d.ts`
- `src/types/state.ts`
- `src/state/actionTypes.ts`
- `src/state/initialState.ts`
- `src/state/reducers/uiReducer.ts`
- `src/state/reducers/characterReducer.ts`
- `src/state/reducers/worldReducer.ts`
- `src/state/reducers/encounterReducer.ts`
- `src/hooks/actions/actionHandlers.ts`
- `src/hooks/actions/handleSystemAndUi.ts`
- `src/hooks/actions/handleResourceActions.ts`
- `src/App.tsx`

## Implemented behavior

- Toggle flow:
  - `toggle_party_overlay` is available in the system menu and routes through `actionHandlers` to `handleTogglePartyOverlay`.
  - `TOGGLE_PARTY_OVERLAY` closes/opens `isPartyOverlayVisible` and gates modal rendering in `GameModals`.
  - `toggle_party_editor` is dev-only via `DevMenu` and routes to `TOGGLE_PARTY_EDITOR_MODAL`.
- Rest flow:
  - Overlay short-rest button uses `gameState.shortRestTracker` to show remaining daily rests.
  - `onShortRest` dispatches `SHORT_REST`, handled by `handleShortRest` with max-per-day and cooldown checks.
  - `onLongRest` dispatches `LONG_REST`, handled by `handleLongRest` with world event/planar updates and timer advance.
- Party composition flow:
  - `SET_PARTY_COMPOSITION` maps `TempPartyMember[]` through `createPlayerCharacterFromTemp`.
  - `SET_FULL_PARTY` writes full `PlayerCharacter[]` directly.
  - `tempParty` is updated from encounter modal payloads and initial editor flows.
- Character sheet context:
  - Roster click opens `OPEN_CHARACTER_SHEET`.
  - Modal receives companion context by `gameState.companions[character.id]` when a companion id exists.

## Companion / party relationship boundary

### Canonical rule (documented 2026-06-08)

Companions and party members occupy **separate identity spaces** with no enforced shared-identity contract:

1. **State domains**:
   - `gameState.party` is `PlayerCharacter[]` — the active combat/roster party.
   - `gameState.companions` is `Record<string, Companion>` — all known companion metadata (approval, relationships, banter, questlines).
   - These are managed by independent reducers (`characterReducer` for party, `companionReducer` for companions).

2. **Best-effort context bridge** (not a membership contract):
   - `CharacterSheetModal` receives optional companion context via `gameState.companions[character.id]`.
   - If the character id matches a companion id, companion metadata enriches the sheet. If not, `companion` is `null` and the sheet renders without it.
   - This lookup is a display convenience, not a membership assertion.

3. **No recruitment / leave business logic exists**:
   - There is no `RECRUIT_COMPANION`, `DISMISS_COMPANION`, or similar action type.
   - Companions have approval, loyalty, relationship levels, and banter — but none of these gates or triggers party membership.
   - The `Companion` type comments note: "For now, we assume they map to a CombatCharacter via ID" — acknowledging the link is aspirational.

4. **Display integration gap**:
   - `RelationshipsPane` renders all companions but is **not mounted** in `PartyOverlay` or `PartyPane`.
   - `PartyOverlay` accepts `party: PlayerCharacter[]` only — no companion data is threaded to the overlay.
   - The party roster and the companion relationship surface are visually and architecturally disconnected.

5. **Dev-only party editing bypass**:
   - `SET_PARTY_COMPOSITION` and `SET_FULL_PARTY` accept raw character arrays with no companion-membership validation.
   - A dev-edited party can contain characters with no companion record, or exclude characters that have active companion state.

### Implications

- A companion can exist in `gameState.companions` with full relationship progression without ever appearing in the party.
- A `PlayerCharacter` can exist in `gameState.party` with no corresponding companion record (e.g., the player's own character, summoned creatures, or dev-spawned NPCs).
- The id-match bridge in `CharacterSheetModal` is the only point where the two domains meet, and it is optional/null-safe.

## Gaps carried forward

- ~~Define companion-party membership rules~~ — **Resolved 2026-06-08**: canonical rule documented above. Separate identity spaces, best-effort id bridge, no recruitment logic.
- Clarify which missing-choice warnings should be surfaced in the overlay path versus compact cards if richer card variants are introduced later.
- Decide whether party roster membership can include non-companion NPC party entities and, if so, what acceptance rule governs them (now blocked on human decision — see GAPS.md G5).
- ~~Keep the Party UI README artifacts aligned with current behavior~~ — **Resolved 2026-06-08**: `PartyOverlay.README.md` and `PartyPane.README.md` rewritten to match current implementation (iteration 5).
- Wire companion relationship data into the PartyOverlay so the roster can show approval/relationship context (see GAPS.md G7).
- ~~Add a companion-id coherence check when party is rebuilt via `SET_FULL_PARTY`~~ — **Resolved 2026-06-08**: regression coverage proves the id bridge for both rebuild paths.
- Add `PartyMemberCard` test coverage (see GAPS.md G9).
- Evaluate short rest modal parity with long rest choice flow (see GAPS.md G10).

## Next checks for the next agent

- All T-tasks (T1–T5) are done.
- G3 is resolved: READMEs aligned with current implementation (iteration 5).
- G5 (roster acceptance rule for non-companion NPCs) remains blocked on human decision; do not touch it.
- G7 (wire companion relationship data into PartyOverlay) is the next safe lane once G5 is decided.
- G9 (add `PartyMemberCard` tests) is an independent test-coverage task.
- G10 (short rest modal parity with long rest) is an independent UX/rules follow-up.
- G4 (missing-choice warning placement rule) is an independent adjacent follow-up.

## Resume path

1. Read this file.
2. Read `docs/projects/party-ui/TRACKER.md`.
3. Read `docs/projects/party-ui/GAPS.md`.
4. Cross-check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md` for classification before scope expansion.
5. All T-tasks (T1–T5) are done. G3 resolved. Next safe lanes: G9 (tests), G4 (warning rule), G7 (companion data, blocked by G5).
6. G5 remains blocked on human decision. G8 and G3 are resolved.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
