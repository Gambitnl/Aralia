---
schema_version: 1
project: Character Sheet
slug: character-sheet
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-12
iteration: 10
confidence: high
evidence: docs/projects/character-sheet
gap_signal: "5 open gaps; G5, G7, G8, G9, and G10 remain open; G3 resolved; G4 README drift closed; G6 intentional placeholder verified and closed"
protocol: living project doc set
next_step: "Implement G7 per D16 (Option A): add durable acquiredAt acquisition-timestamp semantics to the item model, backfill/migrate inventory data, then implement food expiration from that source with a focused InventoryList render test."
agent_comments: "README drift audit closed; journal payload omission is intentional and render-tested; the Skills expertise column remains visible but intentionally zero until the character model exposes expertise state; food freshness timestamp decision recorded 2026-06-10 (D16, Option A) â€” acquiredAt semantics approved."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Character Sheet North Star

Status: active (decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-12

## Why This Project Exists

Character Sheet is an implemented UI feature with modal and tabbed character data views. This project keeps the implementation intent and gaps explicit so future workers can start quickly without re-learning structure.

## Current Scope

- Confirm and document existing Character Sheet surfaces under `src/components/CharacterSheet`, keeping README claims aligned with the windowed tab runtime and the Journal tab's optional payload fallback contract.
- Track state integration points that keep sheet visibility, character payload, inventory, and actions in sync.
- Capture durable gaps from implementation state and keep adjacency scope explicit. The Skills tab's expertise column is intentionally present but still reads as zero because the `PlayerCharacter` model does not expose expertise state yet.

## Active Task Acceptance Criteria

- Verify the README-described tab and component surfaces against the runtime implementation in `src/components/CharacterSheet`.
- Record any real mismatch in `docs/projects/character-sheet/GAPS.md` with source-backed evidence.
- Keep `TRACKER.md` and this handoff aligned on the current open slice; G3 and G6 are resolved, and G7 is now review-required pending a timestamp decision. (Update 2026-06-10: G7 decided â€” D16, Option A; implementation lane open.)

## Dashboard Card Schema

Project: Character Sheet  
Slug: character-sheet  
Category: Feature/UI Projects  
Status: active (decision recorded 2026-06-10; implementation lane open)
Confidence: high
Evidence: docs/projects/character-sheet
Gap signal: 5 open gaps; G5, G7, G8, G9, and G10 remain open; G3 resolved; G4 README drift closed; G6 intentional placeholder verified and closed
Protocol: living project doc set  
Next step: Implement G7 per D16 (Option A): add durable `acquiredAt` acquisition-timestamp semantics, backfill/migrate inventory data, then implement food expiration from that source with a focused InventoryList render test.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08
Agent comments: README drift audit closed; journal payload omission is intentional and render-tested; Skills expertise remains a visible placeholder until the character model exposes expertise state; food freshness timestamp decision recorded 2026-06-10 (D16, Option A).
Human decision required: no (G7 decision recorded 2026-06-10)

## Required Review Brief

Title: Food freshness expiration semantics
Question: Should inventory food expiration be computed from a durable acquisition timestamp in the item model, or should the project introduce a new lifecycle timestamp system before G7 ships?
Issue: `InventoryList.tsx` exposes `perishable` and `shelfLife`, but the `Item` model does not define `acquiredAt` or any other durable acquisition timestamp for inventory freshness.
Current behavior: Perishable food renders an `Expires:` label from `shelfLife`, and the `Eat` action stays enabled because `isExpired` is hardcoded false.
Why blocked: Any local implementation would have to guess when food entered inventory or invent a save-time timestamp path that does not exist in source; that is a system decision, not a UI patch.
Option A: Add durable item acquisition timestamp semantics and backfill or migrate inventory data, then implement expiration from that source.
Option B: Define freshness from an existing authoritative game-date source, or keep the placeholder until another system owns item lifecycles.
Evidence: `src/components/CharacterSheet/Overview/InventoryList.tsx`, `src/types/items.ts`, `src/types/provenance.ts`, `src/data/item_templates/index.ts`, and repo search showing no `acquiredAt` field on `Item`.
Decision owner: Product/system owner for item lifecycle persistence.
Proof after decision: Focused InventoryList render test covering fresh and expired food plus a source-backed data model or migration update.

### Decision (2026-06-10)

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D16 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`):

- **Option A approved.** Add durable `acquiredAt` acquisition-timestamp semantics to the
  item model, backfill/migrate existing inventory data, then implement food expiration
  from that source.
- Proof remains as written above: a focused InventoryList render test covering fresh and
  expired food plus the source-backed data model / migration update.

Status: decision recorded 2026-06-10; implementation lane open.

## Concrete File Map (Owner Surface)

- `src/components/CharacterSheet/CharacterSheetModal.tsx`
  - Main modal shell, tab routing, close behavior, and child tab mounting.
- `src/components/CharacterSheet/Overview/CharacterOverview.tsx`
  - Core stat and trait display.
- `src/components/CharacterSheet/Overview/InventoryList.tsx`
  - Inventory list and item action dispatch.
- `src/components/CharacterSheet/Overview/EquipmentMannequin.tsx`
  - Equipped item rendering and unequip action path.
- `src/components/CharacterSheet/Overview/DynamicMannequinSlotIcon.tsx`
  - Slot visuals for mannequin layout.
- `src/components/CharacterSheet/Skills/SkillsTab.tsx`
  - Skills tab content.
- `src/components/CharacterSheet/Skills/SkillDetailDisplay.tsx`
  - Skills detail pane and per-skill metadata.
- `src/components/CharacterSheet/Details/CharacterDetailsTab.tsx`
  - Extended character display details.
- `src/components/CharacterSheet/Spellbook/SpellbookTab.tsx`
  - Spellbook tab.
- `src/components/CharacterSheet/Spellbook/SpellSlotDisplay.tsx`
  - Spell slot counters.
- `src/components/CharacterSheet/Spellbook/SpellDetailPane.tsx`
  - Spell description/detail area.
- `src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx`
  - Overlay behavior for spell focus state.
- `src/components/CharacterSheet/Crafting/CraftingTab.tsx`
  - Crafting tab.
- `src/components/CharacterSheet/Journal/JournalTab.tsx`
  - Journal tab surface and spread integration.
- `src/components/CharacterSheet/Journal/JournalSpread.tsx`
  - Journal page layout.
- `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`
  - Quest support sidebar for journal tab.
- `src/components/CharacterSheet/Family/FamilyTreeTab.tsx`
  - Family tab.
- `src/components/CharacterSheet/LevelUpModal.tsx`
  - Level-up action container and UPDATE_CHARACTER_CHOICE flow entry.
- `src/components/CharacterSheet/README.md` and related tab READMEs
  - Existing component intent notes, now kept in sync with the windowed tab runtime.
- `src/components/CharacterSheet/__tests__/` and `src/components/CharacterSheet/Spellbook/__tests__/`
  - Modal, overview, mannequin, and spellbook behavior tests.

## State and Wiring

- `src/App.tsx`
  - `handleOpenCharacterSheet` dispatches `OPEN_CHARACTER_SHEET`.
  - `handleCloseCharacterSheet` dispatches `CLOSE_CHARACTER_SHEET`.
- `src/components/layout/GameModals.tsx`
  - Lazy-loads and renders `CharacterSheetModal` from `gameState.characterSheetModal`.
  - Passes `character`, `companion`, `inventory`, `gold`, `onAction`, and `onClose`.
- `src/state/actionTypes.ts`
  - Action unions include `OPEN_CHARACTER_SHEET` and `CLOSE_CHARACTER_SHEET`.
- `src/state/reducers/uiReducer.ts`
  - Reducer handles open/close and resets sheet state when opening other overlays.
- `src/state/reducers/characterReducer.ts`
  - Keeps `characterSheetModal.character` in sync during equip, unequip, drop, auto-equip, prepared spell toggle, and level-up choice updates.
- `src/state/initialState.ts`, `src/state/appState.ts`
  - Initializes and preserves `characterSheetModal` during phase and load transitions.
- `src/types/state.ts`, `src/types/state.d.ts`
  - Defines `gameState.characterSheetModal`.

## Implemented Behavior (Observed)

- Modal renders from state, not from local visibility flags.
- Journal tab accepts an omitted journal payload and falls back to an internal initial state and mock entry instead of crashing; the quest sidebar stays empty until a caller supplies quests.
- Tab set is implemented for:
  - overview
  - skills
  - details
  - family (optional by data)
  - spellbook
  - crafting
  - journal
  - level-up launch path
- Inventory and equipment both dispatch to shared `onAction`.
- Spell tabs include a read path through `SpellbookOverlay` and detail panes.

## Known Gaps To Preserve

- Schema alignment was completed as `G1` in `GAPS.md` with the field-by-field mapping appendix.
- Action payload typing and casing consistency for item use/management actions was normalized to `USE_ITEM` in the shared action contract.
- Component README intent notes were realigned in T4, but future tab or window changes still need a spot check before expansion.
- The Skills expertise column is intentionally present but remains zero until the character model gains expertise state.
- Remaining gap states are `G5` open and `G7` review-required. (Update 2026-06-10: `G7` is decided â€” D16, Option A â€” and is now an open implementation lane.)

## Next Checks for Cold Start

1. Verify `character` shapes against `src/types` across Overview, Details, Spells, and Family tabs; the journal fallback contract is already test-covered.
2. Keep the remaining adjacent gap (`G5`) and the review-required gap (`G7`) linked to evidence in `TRACKER.md` before expanding adjacent work. (`G7` decided 2026-06-10 â€” D16, Option A â€” implement `acquiredAt` semantics, backfill, then expiration.)
3. Carry unresolved schema alignment into project work tracking and keep this folder as the owning handoff point.

## Anchor Files

- [docs/projects/PROJECT_TRACKER.md](F:\Repos\Aralia\docs/projects/PROJECT_TRACKER.md)
- [docs/projects/GLOBAL_GAPS.md](F:\Repos\Aralia\docs/projects/GLOBAL_GAPS.md)
- [docs/projects/character-sheet/TRACKER.md](F:\Repos\Aralia\docs/projects/character-sheet/TRACKER.md)
- [docs/projects/character-sheet/GAPS.md](F:\Repos\Aralia\docs/projects/character-sheet/GAPS.md)


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
