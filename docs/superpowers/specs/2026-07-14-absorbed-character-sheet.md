# Absorbed: Character Sheet

Absorbed 2026-07-14 from `docs/projects/character-sheet/` — living project tracking now lives in planmap `character-sheet` topic with 5 active gaps and 1 completed feature.

## Quick Start

Character Sheet is a modal UI with 7 tabbed surfaces (Overview, Skills, Details, Family, Spellbook, Crafting, Journal) showing player character data, inventory, and progression. The component tree lives under `src/components/CharacterSheet/`.

## File Anchors

- Modal & routing: `src/components/CharacterSheet/CharacterSheetModal.tsx`
- Overview tab (stats, inventory, equipped items): `src/components/CharacterSheet/Overview/`
- Skills, Details, Family, Spellbook, Crafting, Journal tabs: respective subdirectories
- State wiring: `src/state/reducers/characterReducer.ts`, `src/state/reducers/uiReducer.ts`
- Initial state: `src/state/initialState.ts`

## Key Integrations

- Opens via `handleOpenCharacterSheet` in `src/App.tsx`
- Modal state in `gameState.characterSheetModal`
- Inventory/equipment dispatch to shared `onAction` handler
- Lazy-loads from `src/components/layout/GameModals.tsx`

## Known Schema

See the appendix at the end of this document ("Field-by-Field Schema Map", restored from the absorbed folder's GAPS.md) for complete `PlayerCharacter`, `Item`, `Spell`, `JournalState`, and `Quest` payload schemas. Key mismatch: `savingThrowProficiencies` read from `class.*` instead of character root.

## Recent Work

G7 (food freshness, 2026-06-19): Added `acquiredAt` acquisition timestamp to item model; `InventoryList.tsx` now computes expiration from `shelfLife + acquiredAt` instead of hardcoded placeholder.

## Open Work

See planmap topic `character-sheet` for 5 active gaps: G5 (race/derivation contract), G10 (container persistence), G12–G14 (level-up UI and state).


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
| `rewards` | `object` | QuestLogSidebar | Displays rewards indicators (Gold ðŸ’°, XP âœ¨, Items ðŸŽ). |
| `regionHint` | `string` | QuestLogSidebar | Displays geographical region name. |


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
