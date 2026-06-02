# Party UI North Star

Status: active
Last updated: 2026-05-31

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

- Companion browsing and metadata are clearly available in `RelationshipsPane`.
- Party UI itself does not currently define recruit/leave business logic for companions.
- Companion and party membership rules remain external to this project and are the primary unresolved area.

## Gaps carried forward

- Define companion-party membership rules that determine whether and how companion records and `PlayerCharacter` party entries share identity and lifecycle rules.
- Clarify which missing-choice warnings should be surfaced in the overlay path versus only inside compact cards if richer card variants are introduced later.

## Next checks for the next agent

- Validate persistence behavior for `shortRestTracker` after load/save and day rollover.
- Validate that character-sheet companion context stays correct when party is rebuilt via `SET_FULL_PARTY` and when encounter temp party changes.
- Confirm if party roster should include non-companion NPC party entities and document the acceptance rule.

## Resume path

1. Read this file.
2. Read `docs/projects/party-ui/TRACKER.md`.
3. Read `docs/projects/party-ui/GAPS.md`.
4. Cross-check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md` for classification before scope expansion.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
