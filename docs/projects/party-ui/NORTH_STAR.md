---
schema_version: 1
project: Party UI
slug: party-ui
category: Feature/UI Projects
main_category: "Content & Rules"
subcategory: "Rules, Spells & Source Data"
status: partial
last_updated: 2026-06-12
iteration: 6
confidence: medium
evidence: docs/projects/party-ui
gap_signal: "6 open gaps; G4 through G7 and G9 through G10 remain open after G1-G3 and G8 closure"
protocol: living project doc set
next_step: "G5 decided 2026-06-10 (D15): roster MAY include non-companion NPCs under an explicit acceptance rule Ã¢â‚¬â€ write the acceptance rule (membership model, sheet context, save/load semantics) as step one of the implementation slice, which then unblocks G7; G9 (PartyMemberCard tests) and G4 (warning placement rule) remain independent tasks."
agent_comments: ""
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
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Party UI North Star

Status: active (G5 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-12

## Dashboard Card Schema

Project: Party UI
Slug: party-ui
Category: Feature/UI Projects
Status: partial
Confidence: medium
Evidence: docs/projects/party-ui
Gap signal: 6 open gaps; G4 through G7 and G9 through G10 remain open after G1-G3 and G8 closure
Protocol: living project doc set
Next step: G5 decided 2026-06-10 (D15): write the explicit roster acceptance rule for non-companion NPCs (membership model, sheet context, save/load semantics) as step one of the implementation slice; that unblocks G7 (companion data in overlay); G9 (PartyMemberCard tests) and G4 (warning placement rule) remain independent tasks.
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

Status: decision recorded 2026-06-10; implementation lane open.

## Next checks for the next agent

- All T-tasks (T1Ã¢â‚¬â€œT5) are done.
- G3 is resolved: READMEs aligned with current implementation (iteration 5).
- G5 (roster acceptance rule for non-companion NPCs) remains blocked on human decision; do not touch it. **Update 2026-06-10: decided (D15) Ã¢â‚¬â€ write the acceptance rule as step one of the implementation slice.**
- G7 (wire companion relationship data into PartyOverlay) is the next safe lane once G5 is decided. **G5 is decided 2026-06-10; G7 opens once the acceptance rule is written.**
- G9 (add `PartyMemberCard` tests) is an independent test-coverage task.
- G10 (short rest modal parity with long rest) is an independent UX/rules follow-up.
- G4 (missing-choice warning placement rule) is an independent adjacent follow-up.

## Resume path

1. Read this file.
2. Read `docs/projects/party-ui/TRACKER.md`.
3. Read `docs/projects/party-ui/GAPS.md`.
4. Cross-check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md` for classification before scope expansion.
5. All T-tasks (T1Ã¢â‚¬â€œT5) are done. G3 resolved. Next safe lanes: G9 (tests), G4 (warning rule), G7 (companion data, blocked by G5).
6. G5 remains blocked on human decision. G8 and G3 are resolved.
7. Update 2026-06-10: G5 is decided (D15, `docs/projects/DECISION_BLITZ_2026-06-10.md`) Ã¢â‚¬â€ write the explicit acceptance rule as step one of the implementation slice; that unblocks G7.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

## Required Review Brief

Title: Party UI partial due to roster acceptance rule
Question: What acceptance rule governs non-companion NPCs in the party roster?
Issue: D15 decided the roster may include non-companion NPCs, but implementation still needs the membership, sheet-context, and save/load acceptance rule.
Current behavior: The next step says writing that acceptance rule is step one and unblocks G7; G9 and G4 remain independent tasks.
Why blocked: Implementation without the rule risks breaking identity, character sheet, and save/load semantics.
Option A: Write the acceptance rule first, then implement the roster behavior.
Option B: Delay implementation until the companion/party boundary gets a narrower owner decision.
Evidence: NORTH_STAR.md next_step; GAPS.md G1-G3; D15 reference in gap_signal.
Decision owner: Party UI owner / human operator if acceptance wording changes
Proof after decision: Tracker records the acceptance rule and the implementation slice verifies membership plus save/load semantics.
