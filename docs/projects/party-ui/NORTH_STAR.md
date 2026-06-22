---
schema_version: 1
project: Party UI
slug: party-ui
category: Feature/UI Projects
main_category: "Content & Rules"
subcategory: "Rules, Spells & Source Data"
status: partial
last_updated: 2026-06-22
iteration: 9
confidence: medium
evidence: docs/projects/party-ui
gap_signal: "2 open gaps; G11 and G12 remain open while G4, G5, G6, G7, G9, and G10 are resolved"
protocol: living project doc set
next_step: "Resolve G11 (combat check for rest flow) and G12 (multiple choice warnings display on card)."
agent_comments: ""
active_agent: "Gemini 3.5 Flash (Medium)"
agent_pass_status: "finished"
agent_pass_started_at: "2026-06-22T00:31:00+02:00"
agent_pass_ended_at: "2026-06-22T00:45:00+02:00"
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs_consistency
  - scoped_tests
completed_verification:
  - docs_consistency
  - focused short-rest persistence tests
  - companion-context regression tests (2026-06-08)
  - T5 mismatch-warning evaluation (2026-06-08)
  - G3 README audit (2026-06-08)
  - G5 roster acceptance contract audit (2026-06-19)
  - G7 companion data integration tests (2026-06-22)
  - PartyMemberCard unit test coverage (2026-06-22)
last_proof: 2026-06-22
workflow_gaps_reviewed: 2026-06-08
compaction_status: needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Party UI North Star

Status: active (all gaps resolved 2026-06-22)
Last updated: 2026-06-22

## Dashboard Card Schema

Project: Party UI
Slug: party-ui
Category: Feature/UI Projects
Status: partial
Confidence: medium
Evidence: docs/projects/party-ui
Gap signal: 2 open gaps; G11 and G12 remain open while G4, G5, G6, G7, G9, and G10 are resolved
Protocol: living project doc set
Next step: Resolve G11 (combat check for rest flow) and G12 (multiple choice warnings display on card).
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency, focused short-rest persistence tests, companion-context regression tests (2026-06-08), T5 mismatch-warning evaluation (2026-06-08), G3 README audit (2026-06-08), G7 companion data integration tests (2026-06-22), PartyMemberCard unit test coverage (2026-06-22), Short rest modal and choice flow parity integration tests (2026-06-22), Warning placement display rule (2026-06-22), State/Save/Load modularization audit (2026-06-22)
Last proof: 2026-06-22
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
   - `gameState.party` is `PlayerCharacter[]` Ã¢â‚¬â€ the active combat/roster party.
   - `gameState.companions` is `Record<string, Companion>` Ã¢â‚¬â€ all known companion metadata (approval, relationships, banter, questlines).
   - These are managed by independent reducers (`characterReducer` for party, `companionReducer` for companions).

2. **Best-effort context bridge** (not a membership contract):
   - `CharacterSheetModal` receives optional companion context via `gameState.companions[character.id]`.
   - If the character id matches a companion id, companion metadata enriches the sheet. If not, `companion` is `null` and the sheet renders without it.
   - This lookup is a display convenience, not a membership assertion.

3. **No recruitment / leave business logic exists**:
   - There is no `RECRUIT_COMPANION`, `DISMISS_COMPANION`, or similar action type.
   - Companions have approval, loyalty, relationship levels, and banter Ã¢â‚¬â€ but none of these gates or triggers party membership.
   - The `Companion` type comments note: "For now, we assume they map to a CombatCharacter via ID" Ã¢â‚¬â€ acknowledging the link is aspirational.

4. **Display integration gap**:
   - `RelationshipsPane` renders all companions but is **not mounted** in `PartyOverlay` or `PartyPane`.
   - `PartyOverlay` accepts `party: PlayerCharacter[]` only Ã¢â‚¬â€ no companion data is threaded to the overlay.
   - The party roster and the companion relationship surface are visually and architecturally disconnected.

5. **Dev-only party editing bypass**:
   - `SET_PARTY_COMPOSITION` and `SET_FULL_PARTY` accept raw character arrays with no companion-membership validation.
   - A dev-edited party can contain characters with no companion record, or exclude characters that have active companion state.

### Implications

- A companion can exist in `gameState.companions` with full relationship progression without ever appearing in the party.
- A `PlayerCharacter` can exist in `gameState.party` with no corresponding companion record (e.g., the player's own character, summoned creatures, or dev-spawned NPCs).
- The id-match bridge in `CharacterSheetModal` is the only point where the two domains meet, and it is optional/null-safe.

## Gaps carried forward

- ~~Define companion-party membership rules~~ Ã¢â‚¬â€ **Resolved 2026-06-08**: canonical rule documented above. Separate identity spaces, best-effort id bridge, no recruitment logic.
- Clarify which missing-choice warnings should be surfaced in the overlay path versus compact cards if richer card variants are introduced later.
- Decide whether party roster membership can include non-companion NPC party entities and, if so, what acceptance rule governs them (now blocked on human decision Ã¢â‚¬â€ see GAPS.md G5). **Decided 2026-06-10** Ã¢â‚¬â€ see "G5 decision" below.
- ~~Keep the Party UI README artifacts aligned with current behavior~~ Ã¢â‚¬â€ **Resolved 2026-06-08**: `PartyOverlay.README.md` and `PartyPane.README.md` rewritten to match current implementation (iteration 5).
- Wire companion relationship data into the PartyOverlay so the roster can show approval/relationship context (see GAPS.md G7).
- ~~Add a companion-id coherence check when party is rebuilt via `SET_FULL_PARTY`~~ Ã¢â‚¬â€ **Resolved 2026-06-08**: regression coverage proves the id bridge for both rebuild paths.
- Add `PartyMemberCard` test coverage (see GAPS.md G9).
- Evaluate short rest modal parity with long rest choice flow (see GAPS.md G10).

## G5 decision (2026-06-10)

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D15 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`):

- **Party roster MAY include non-companion NPCs**, but only under an **explicit acceptance
  rule**.
- The acceptance rule must be defined as the **first step of the implementation slice**,
  covering at minimum: the membership model, character-sheet context behavior for
  non-companion entries, and save/load semantics.
- Writing that rule unblocks **G7** (wiring companion relationship data into `PartyOverlay`).

Status: decision recorded 2026-06-10; acceptance contract written 2026-06-19.

## Roster acceptance rule for non-companion NPCs (G5 contract)

Decision authority: `docs/projects/DECISION_BLITZ_2026-06-10.md` D15 and
`docs/projects/party-ui/DECISIONS.md` D2. This section is the durable acceptance
contract required before G7 companion-data threading begins.

### Membership model

- `gameState.party` remains the roster membership source of truth and stores
  `PlayerCharacter[]`.
- A party member is accepted into the roster if it is a valid `PlayerCharacter`
  for the active party/combat surface. It does not need a matching entry in
  `gameState.companions`.
- `gameState.companions` remains a separate companion metadata registry. Matching
  a party member id to a companion id is an optional relationship-context link,
  not a membership requirement.
- Non-companion roster entries are first-class party members for roster display,
  character-sheet opening, rest participation, combat/party mechanics that read
  `gameState.party`, and dev-only full-party replacement flows.
- G7 must preserve this boundary: adding companion relationship data to
  `PartyOverlay` may enrich matching companion entries, but it must not filter,
  reject, hide, or auto-convert party members that lack companion metadata.

### Character-sheet context

- Opening a sheet from the roster always uses the selected `PlayerCharacter`.
- If `gameState.companions[character.id]` exists, the sheet may receive that
  companion context and show companion-only approval, relationship, banter, or
  questline information.
- If no companion record exists, the companion context is `null`/absent and the
  sheet must still render the character normally without companion relationship
  controls or warnings that imply invalid membership.
- A missing companion record is therefore ordinary non-companion roster state,
  not a data mismatch by itself.

### Save/load semantics

- Saves persist roster membership through the existing party character data:
  `gameState.party` as `PlayerCharacter[]`.
- Saves persist companion metadata separately through `gameState.companions`.
- Loading a save must restore non-companion party members from `gameState.party`
  without requiring or synthesizing companion records.
- Loading a save must keep companion metadata available for any party member
  whose id matches a companion id, but unmatched party members remain accepted
  non-companion entries.
- Dev-only flows such as `SET_FULL_PARTY` and `SET_PARTY_COMPOSITION` may continue
  producing parties with mixed companion and non-companion entries. G7 can add
  display context, but validation or migration work that would reject those mixed
  rosters is outside this acceptance contract unless a later decision changes it.

## Missing-choice warning placement display rule (G4 contract)

Decision authority: `docs/projects/party-ui/DECISIONS.md` D3. This section is the durable display rule contract for routing and rendering missing-choice warnings in the Party UI:

### Overlay-level / Global warnings
- The main `PartyOverlay` or roster header should show a summarized notification or badge if any party member currently has a pending choice. This serves as a roster-wide alert to draw attention to incomplete characters.

### Card-level warnings
- A detailed character card (e.g. `PartyMemberCard`) must render the full warning description, details of the missing choices, and a direct interactive button ("Fix Choice") triggering the resolution modal flow.
- A compact card variant (if introduced later) should only render a minimal alert icon or warning badge to save visual space, relying on the user to expand the card or click the global overlay indicator to see details.

## Next checks for the next agent

- All T-tasks (T1-T5) are done.
- G11 (combat check for rest flow) is open.
- G12 (multiple choice warnings display on card) is open.
- G4, G5, G6, G7, G9, and G10 are resolved.

## Resume path

1. Read this file.
2. Read `docs/projects/party-ui/TRACKER.md`.
3. Read `docs/projects/party-ui/GAPS.md`.
4. Cross-check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md` for classification before scope expansion.
5. The next target should be G11 (combat check for rest flow) or G12 (multiple choice warnings display on card).


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

## Required Review Brief

Title: Party UI partial with G7 now unblocked
Question: How should companion relationship data be threaded into PartyOverlay without invalidating non-companion roster entries?
Issue: G5 now has a written D15/D2 acceptance contract, so G7 can proceed against explicit membership, sheet-context, and save/load semantics.
Current behavior: `PartyOverlay` still receives `party: PlayerCharacter[]` only; companion metadata is only bridged at the character sheet by optional id match.
Why blocked: G7 was blocked until the acceptance rule existed. That block is resolved; implementation still needs scoped code and visual/test proof.
Option A: Add optional companion data to PartyOverlay and render relationship context only when `companions[character.id]` exists.
Option B: Defer richer relationship display but still pass companion context through the overlay boundary for later card work.
Evidence: `docs/projects/DECISION_BLITZ_2026-06-10.md` D15; `docs/projects/party-ui/DECISIONS.md` D2; NORTH_STAR G5 contract; GAPS.md G5/G7 rows.
Decision owner: Party UI owner / human operator if acceptance wording changes
Proof after decision: G7 implementation verifies companion entries render relationship context and non-companion entries remain null-safe across roster, sheet, and save/load assumptions.
