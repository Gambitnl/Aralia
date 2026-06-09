# Character Sheet Gaps

Status: review-required
Last updated: 2026-06-08

Use this file only for durable unresolved findings that belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Worker B | docs/projects/character-sheet/TRACKER.md | docs/scan + feature evidence | Align character sheet fields with character schema | `docs/projects/PROJECT_TRACKER.md` (Character Sheet row) and `src/components/CharacterSheet/*` | Current implementation renders many fields from `character` payloads without one stable field map | Completed field-by-field map appendix in GAPS.md | mapping table and approval note in `NORTH_STAR.md` |
| G2 | done | support_needed_now | gpt-5.3-codex-spark / MCP-subagent | `src/state` / `src/components/CharacterSheet` | implementation scan | Normalize sheet inventory action contract | `src/components/CharacterSheet/Overview/InventoryList.tsx`, `src/types/actions.ts`, `src/hooks/actions/actionHandlers.ts`, `src/utils/combat/actionUtils.ts`, `src/state/reducers/characterReducer.ts` | Mixed action casing between UI and reducer path could drift (`use_item` vs `USE_ITEM`) | Normalize all item action emits/logging/reducers to `USE_ITEM` while keeping `EQUIP_ITEM` and `DROP_ITEM` as uppercase and unchanged | Evidence: added `characterReducer` and `getDiegeticPlayerActionMessage` tests covering `USE_ITEM`, `EQUIP_ITEM`, and `DROP_ITEM` in `src/state/reducers/__tests__/characterReducer.test.ts` and `src/utils/combat/__tests__/actionUtils.test.ts` |
| G3 | done | support_needed_now | gpt-5.4-mini high / MCP-subagent | `src/components/CharacterSheet/Journal` | implementation scan | Confirm Journal tab state contract | `src/components/CharacterSheet/CharacterSheetModal.tsx`, `src/components/CharacterSheet/Journal/JournalTab.tsx`, `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`, `src/components/CharacterSheet/Journal/JournalSpread.tsx`, `src/components/CharacterSheet/Journal/__tests__/JournalTab.test.tsx` | Optional `journal` prop and quest linkage are intentionally nullable; the tab self-initializes when callers omit payloads | Contract clarified in docs and render test; no runtime correction needed | Proceed to G6 |
| G4 | done | adjacent_follow_up | gpt-5.4-mini high / MCP-subagent | project docs | README audit | Keep one canonical map of tab feature intent | `src/components/CharacterSheet/CharacterSheetModal.README.md`, `src/components/CharacterSheet/README.md`, `src/components/CharacterSheet/CharacterSheetModal.tsx`, `src/components/ui/WindowFrame.tsx`, `src/components/layout/GameModals.tsx` | Local READMEs described a stale overlay / column model instead of the live tabbed WindowFrame shell | README docs updated to match runtime tab surfaces and column roles | None; docs consistency check and diff check complete |
| G5 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G8 | Code modularization audit routing | Character/race derivation and race presentation are large enough that future splits need a sheet-consumer contract. | `src/utils/character/characterUtils.ts`; `src/data/races/racialTraits.ts`; `src/components/CharacterCreator/Race/RaceDetailPane.tsx`; `src/components/CharacterSheet/*` | Character sheet consumers can drift if character build output changes during creator modularization. | Add a sheet-owned acceptance map for fields that depend on character/race derivation before creator split work starts. | Character sheet field mapping table plus `characterUtils` tests referenced in split plan |
| G6 | done | adjacent_follow_up | gpt-5.4-mini high / MCP-subagent | `src/components/CharacterSheet/Skills` | codebase audit + contract proof | Skills expertise display intentionally remains at 0 until the character model exposes expertise state | `src/components/CharacterSheet/Skills/SkillsTab.tsx`, `src/components/CharacterSheet/Skills/SkillDetailDisplay.tsx`, `src/components/CharacterSheet/Skills/__tests__/SkillsTab.test.tsx`, `src/types/core.ts`, `src/data/feats/featsData.ts` | No `expertise` field exists in `PlayerCharacter` or `Skill`; the UI column is a visible placeholder rather than a broken calculation. | Revisit the display when Skill Expert or another system adds expertise state to the character model. | `SkillsTab.test.tsx` render proof plus source read showing no model-backed expertise field |
| G7 | blocked | blocked_human_decision | gpt-5.4-mini high / MCP-subagent | `src/components/CharacterSheet/Overview` | codebase audit | Hardcoded food decay / expiration in `InventoryList.tsx` needs a lifecycle decision before implementation | `src/components/CharacterSheet/Overview/InventoryList.tsx#L408-L481`, `src/types/items.ts`, `src/types/provenance.ts`, `src/data/item_templates/index.ts` | The `isExpired` flag is a hardcoded placeholder (`const isExpired = false`), but the `Item` model only exposes `perishable` and a descriptive `shelfLife`; there is no durable `acquiredAt` field or wired inventory timestamp to compute freshness from safely. | Wait for the Required Review Brief decision on timestamp semantics, then implement the approved freshness source. | Decision record plus a focused InventoryList render test for fresh and expired food. |
| G8 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | `src/components/CharacterSheet/Overview` | codebase audit | Character Sheet does not provide visual feedback (e.g. red text or a warning icon) when a character suffers a speed penalty from wearing Heavy Armor without meeting the Strength requirement. | `src/components/CharacterSheet/Overview/CharacterOverview.tsx`, `src/utils/character/characterUtils.ts` | Obscures mechanical penalties, leading to confusion about why speed values are lower than expected. | Add a warning indicator to the Speed field in `CharacterOverview` when an armor-based penalty is active. | Verify warning visibility for a low-STR character in Plate armor. |
| G9 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | `src/components/CharacterSheet/Overview` | codebase audit | Equippable items without defined slots are incorrectly skipped or blocked in `InventoryList.tsx` | `src/components/CharacterSheet/Overview/InventoryList.tsx#L400-L407` | Valid equippable items that lack a slot property are treated as non-equippable/blocked rather than logging a warning. | Log a warning for equippable items without slots or handle them gracefully in the equip flow. | Test coverage or verification showing graceful handling of slotless equippable items. |
| G10 | untriaged | adjacent_follow_up | Gemini 3.5 Flash | `src/components/CharacterSheet/Overview` | codebase audit | Container assignments live in transient local React state instead of persistent global state | `src/components/CharacterSheet/Overview/InventoryList.tsx#L274-L296` | Item assignments to bags/containers are lost whenever the character sheet modal closes and remounts. | Migrate container assignments to the global `gameState` or store `containerId` changes in the item model via reducer actions. | Verify bag assignments persist after closing and reopening the character sheet modal. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly continue without it. |
| `support_needed_now` | Required for the project to progress safely in the same scope. |
| `adjacent_follow_up` | Related future work that should be tracked but is not blocking current continuity. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | Owner approval or external policy decision is required. |
| `blocked_external_state` | Waiting on another actor or external dependency. |

## Update Rules

- Keep each row linked to concrete evidence.
- Keep only durable project-owned gaps here; route unrelated items to `docs/projects/GLOBAL_GAPS.md`.

---

## Appendix: Field-by-Field Schema Map

Below is the authoritative mapping of fields consumed by the Character Sheet components, detailing where each field is used and how it is resolved.

### 1. `PlayerCharacter` Schema Mapping

| Field | Type | Consuming Tab/Component | Description / Usage | Mismatch or Ambiguity Notes |
|---|---|---|---|---|
| `id` | `string` | Modal Shell / `CharacterSheetModal.tsx` | Identifies character; resets active tab when changed, dispatches action payloads. | None. |
| `name` | `string` | Modal Shell, Overview, Details, Family | Display name of the character. | None. |
| `soul` | `any` | Details | Provides personality values/fears/quirks, goals, identity name/description, and reactionStyle. | Type is currently `any` to avoid circular dependencies with `CompanionSoul`. |
| `age` | `number` | Overview, Details | Displays character's age. | Overridden by `identity.age` in Details if available. |
| `background` | `string` | Overview, Details | Background name. Overview replaces underscores with spaces; Details capitalizes it. | Inconsistent string transformations (underscores replacement vs pure capitalization). |
| `level` | `number` | Overview, Spellbook | Displays character level; Spellbook checks level to identify future racial spells. | None. |
| `xp` | `number` | Overview | Displays current experience points. | None. |
| `proficiencyBonus` | `number` | Overview, Skills | Calculates saving throws, passive senses, skill modifiers, and spell DC/attack bonus. Defaults to 2 if missing. | None. |
| `race` | `Race` | Overview, Details, Family | Consumed by `getCharacterRaceDisplayString`, lists race traits, and displays race name. | None. |
| `race.id` | `string` | Skills | Checked in `SkillsTab.tsx` for `deep_gnome` Svirfneblin Camouflage advantage. | Hardcoded check for `deep_gnome` rather than consuming a generic trait property flags system. |
| `race.traits` | `string[]` | Overview, Skills | Lists general traits (parsed by `:`). `SkillsTab` checks trait text for Svirfneblin Camouflage. | String parsing of traits with `:` is fragile. |
| `race.knownSpells` | `RacialSpell[]` | Spellbook | Retrieves level requirements and spell IDs granted by character heritage. | None. |
| `class` | `Class` | Overview, Details, Family, Spellbook | Displays class name, reads saving throws, armor/weapon proficiencies, and class features. | None. |
| `class.id` | `string` | Overview, Spellbook | Checked for `barbarian` and `monk` (unarmored AC) and to determine spellcasting lists / caster type. | String-based subclass and class check logic. |
| `class.savingThrowProficiencies` | `AbilityScoreName[]` | Overview | Marks saving throw proficiency dots. | Mismatch: The `savingThrowProficiencies` array on the character root object is bypassed in favor of `class.savingThrowProficiencies`. |
| `class.armorProficiencies` | `string[]` | Overview, Mannequin | Populates general proficiencies and checks shield proficiency. | None. |
| `class.features` | `ClassFeature[]` | Overview | Lists class features in "Features & Traits". | None. |
| `finalAbilityScores` | `AbilityScores` | Overview, Skills, Mannequin | Renders modifiers and scores, and calculates weapon damage bonuses. | None. |
| `skills` | `Skill[]` | Overview, Skills | Calculates passive skills and renders skill proficiency bonuses. | None. |
| `feats` | `string[]` | Overview | Lists selected feats. | None. |
| `featChoices` | `Record<string, FeatChoice>` | Overview | Displays selected ability score improvements per feat. | None. |
| `hp` / `maxHp` / `tempHP` | `number` | Overview | Displays hit points and temporary hit points. | None. |
| `isFlying` | `boolean` | Overview | Adds "(Flying)" badge next to speed. | None. |
| `armorClass` | `number` | Overview | Displays calculated armor class. | None. |
| `speed` | `number` | Overview | Displays speed in feet. | None. |
| `darkvisionRange` | `number` | Overview | Displays darkvision range in feet. | None. |
| `selectedWeaponMasteries` | `string[]` | Overview | Lists unlocked weapon mastery traits. | None. |
| `spellcastingAbility` | `string` | Overview | Determines spellcasting ability modifier, save DC, and attack bonus. | None. |
| `spellSlots` | `SpellSlots` | Overview, Spellbook | Displays remaining/max spell slots per level. | None. |
| `spellbook` | `SpellbookData` | Modal Shell, Spellbook | Populates cantrips, preparedSpells, knownSpells, and racialSpellGrants. | None. |
| `resistances` / `immunities` / `vulnerabilities` | `DamageType[]` | Overview | Lists defenses in "Damage Defenses". | None. |
| `selectedFightingStyle` | `FightingStyle` | Overview | Displays selected fighting style. | None. |
| `selectedDivineOrder` / `selectedDruidOrder` / `selectedWarlockPatron` | `string` | Overview | Displays chosen subclasses / orders. | None. |
| `equippedItems` | `Record` | Overview, Mannequin | Renders equipped items and calculates AC / weapon damage tooltips. | None. |
| `richNpcData` | `object` | Modal Shell, Details, Family | Populates family details, age, and physical description. | None. |

### 2. `Item` Payload Schema Mapping (Inventory & Mannequin)

| Field | Type | Component | Usage | Mismatch / Ambiguity Notes |
|---|---|---|---|---|
| `id` | `string` | InventoryList | Handles action payloads (equipping, using, dropping). | None. |
| `name` | `string` | Mannequin, InventoryList | Renders name in slot, list item, and action labels. | None. |
| `type` | `string` | Mannequin, InventoryList | Checked for 'armor', 'weapon', 'consumable', 'food_drink', etc. | None. |
| `slot` | `EquipmentSlotType` | InventoryList | Filters inventory items compatible with a selected mannequin slot. | Mismatch: Items without a slot cannot be equipped, even if they are weapons or armor. |
| `description` | `string` | InventoryList | Renders tooltip description. | None. |
| `weight` | `number` | InventoryList | Calculates inventory weight. | None. |
| `cost` | `string` | InventoryList | Displays cost in tooltips. | None. |
| `armorCategory` | `ArmorCategory` | Mannequin, InventoryList | Checked for shield and armor proficiency verification. | None. |
| `baseArmorClass` / `armorClassBonus` | `number` | InventoryList, Overview | Calculates AC tooltip values and shows AC delta upgrades. | None. |
| `strengthRequirement` / `stealthDisadvantage` | `boolean`/`number` | InventoryList | Displays requirements and penalties in tooltip. | None. |
| `addsDexterityModifier` / `maxDexterityBonus` | `boolean`/`number` | InventoryList, Overview | Calculates AC tooltip details. | None. |
| `damageDice` / `damageType` / `properties` | `string` / `string[]` | Mannequin, InventoryList | Calculates weapon damage bonuses and details. | None. |
| `effect` | `string` / `object` | InventoryList | Displays consumable usage effects in tooltip. | Type can be string or object depending on item type, requiring manual type-guarding. |
| `shelfLife` / `nutritionValue` / `perishable` | `string` / `number` / `boolean` | InventoryList | Displays food freshness and nutritional value. | No decay logic is implemented yet (see Gap G7). |
| `rarity` | `string` | InventoryList | Displays reagent rarity in tooltips. | None. |
| `statBonuses` | `Record` | InventoryList | Displays stat bonuses in tooltips. | None. |
| `requirements` | `object` | InventoryList | Renders class, level, strength, and dexterity requirements. | None. |
| `isContainer` / `capacitySlots` / `capacityWeight` | `boolean` / `number` | InventoryList | Determines container/bag capability. | None. |
| `containerId` | `string` | InventoryList | Identifies which bag an item is inside. | Groupings currently live in local component state. |

### 3. `Spell` Payload Schema Mapping (Spellbook)

| Field | Type | Component | Usage |
|---|---|---|---|
| `id` | `string` | SpellbookTab | Handles selecting spells and dispatching toggle preparation actions. |
| `name` | `string` | SpellbookTab, SpellDetailPane | Renders spell name. |
| `level` | `number` | SpellbookTab, SpellDetailPane | Renders level tab and determines level heading. |
| `school` | `SpellSchool` | SpellDetailPane | Displays spell school (e.g. Evocation). |
| `castingTime` | `object` | SpellDetailPane | Displays casting action/bonus/reaction details. |
| `range` | `object` | SpellDetailPane | Displays range type and distance. |
| `components` | `object` | SpellDetailPane | Displays Verbal/Somatic/Material requirements. |
| `duration` | `object` | SpellDetailPane | Displays concentration and duration timers. |
| `description` | `string` | SpellDetailPane | Renders spell description prose. |
| `higherLevels` | `string` | SpellDetailPane | Renders "At Higher Levels" modifier block. |
| `classes` | `string[]` | SpellDetailPane | Displays classes capable of casting the spell. |
| `ritual` | `boolean` | SpellDetailPane | Renders "Ritual" tag if applicable. |

### 4. `JournalState` Schema Mapping (Journal)

| Field | Type | Component | Usage |
|---|---|---|---|
| `entries` | `JournalEntry[]` | JournalTab, JournalSpread | Populates narrative pages and recaps. |
| `entries.sessionNumber` | `number` | JournalSpread | Displays session number in header. |
| `entries.gameYear` / `gameDate` | `string` | JournalSpread | Renders in-game timeline stamps. |
| `entries.narrativeText` | `string` | JournalSpread | Renders narrative prose (split by double newlines). |
| `entries.sketchNotes` | `string` | JournalSpread | Displays player notes in handwritten font. |
| `entries.pageNumber` | `number` | JournalSpread | Renders page number footer. |
| `entries.recap.keyEvents` | `SessionKeyEvent[]` | JournalSpread | Displays key events check list (completed vs question). |
| `entries.recap.loot` | `JournalLootEntry[]` | JournalSpread | Renders list of loot items (shows Unidentified status). |
| `entries.recap.currentObjectives` | `SessionObjective[]` | JournalSpread | Renders primary/secondary objectives list. |
| `entries.autoLoggedEvents` | `JournalEvent[]` | JournalSpread | Renders chronicle feed (combat, accepts, trades, etc.). |

### 5. `Quest` Payload Schema Mapping (Journal Tab Sidebar)

| Field | Type | Component | Usage |
|---|---|---|---|
| `id` | `string` | QuestLogSidebar | Handles active quest selection. |
| `status` | `QuestStatus` | QuestLogSidebar | Filters quests between Active and Completed. |
| `questType` | `QuestType` | QuestLogSidebar | Renders quest category badge (Main, Side, Personal, etc.). |
| `title` | `string` | QuestLogSidebar | Renders quest title. |
| `description` | `string` | QuestLogSidebar | Renders description preview block. |
| `rewards` | `object` | QuestLogSidebar | Displays rewards indicators (Gold 💰, XP ✨, Items 🎁). |
| `regionHint` | `string` | QuestLogSidebar | Displays geographical region name. |
