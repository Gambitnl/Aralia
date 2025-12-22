# Combat

## Purpose

The Combat domain handles all tactical combat mechanics including initiative tracking, action economy, attack resolution, damage calculation, conditions, and turn management. It implements D&D 5e combat rules.

## Key Entry Points

| File | Role |
|------|------|
| `src/utils/combatUtils.ts` | Core combat calculations (24KB) |
| `src/hooks/combat/` | Combat-related hooks |
| `src/systems/combat/` | Combat subsystems |
| `src/components/Combat/` | Combat UI components |

## Subcomponents

- **Attack System**: `AttackEventEmitter.ts`, `AttackRiderSystem.ts` - Attack events and riders
- **Movement System**: `MovementEventEmitter.ts` - Movement during combat
- **Save System**: `SavePenaltySystem.ts` - Saving throw penalties
- **Action System**: `SustainActionSystem.ts` - Sustained action tracking
- **Combat Hooks**: `src/hooks/combat/` - React hooks for combat state
- **UI Components**: `src/components/Combat/` - Combat interface elements

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/combat/*.ts` | Directory | Combat subsystems |
| `src/systems/events/CombatEvents.ts` | Events | Combat events |
| `src/hooks/combat/**/*.ts` | Directory | Combat hooks |
| `src/hooks/actions/*.ts` | Directory | Action handlers |
| `src/components/Combat/*.ts*` | Directory | Combat UI and index |
| `src/components/ActionPane/*.ts*` | Directory | Action interface components |
| `src/components/Encounter*.tsx` | Component | Encounter modals and managers |
| `src/data/monsters.ts` | Data | Monster definitions |
| `src/data/summonTemplates.ts` | Data | Summon templates |
| `src/data/masteryData.ts` | Data | Weapon mastery data |
| `src/systems/logic/ConditionEvaluator.ts` | Logic | Logic evaluation for combat/conditions |
| `src/state/reducers/encounterReducer.ts` | Reducer | Encounter state |
| `src/state/reducers/logReducer.ts` | Reducer | Combat log state |
| `src/services/geminiService*.ts` | Service | AI generation services |
| `src/utils/combat/*.ts` | Utils | Combat utilities |
| `src/utils/combat/actionEconomyUtils.ts` | Utils | Action economy helper |
| `src/utils/movementUtils.ts` | Utils | Movement validation |
| `src/utils/weaponUtils.ts` | Utils | Weapon and proficiency helpers |
| `src/utils/encounterUtils.ts` | Utils | Encounter helpers |
| `src/utils/combatUtils.ts` | Utils | Combat calculations |
| `src/utils/savingThrowUtils.ts` | Utils | Saving throw logic |
| `src/utils/targetingUtils.ts` | Utils | Target selection |
| `src/utils/aoeCalculations.ts` | Utils | Area of effect math |
| `src/utils/lineOfSight.ts` | Utils | Line of sight checks |
| `src/types/combat.ts` | Types | Combat type definitions |


## Dependencies

### Depends On

- **[Spells](./spells.md)**: Spell casting in combat
- **[Character Sheet](./character-sheet.md)**: Character stats for calculations
- **[NPCs / Companions](./npcs-companions.md)**: NPC/companion combat actions

### Used By

- **[Battle Map](./battle-map.md)**: Visualizes combat state
- **[Submap](./submap.md)**: Initiates encounters
- **App.tsx**: Combat mode rendering

## Boundaries / Constraints

- Combat state should be managed through proper action dispatch
- Damage calculations must respect resistance/immunity/vulnerability
- Initiative order is authoritative for turn sequence
- Combat should not directly modify character permanent stats

## Open Questions / TODOs

- [ ] Document action economy rules implementation
- [ ] Clarify relationship between combat hooks and utils
- [ ] Map reaction and bonus action handling

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/utils/combat/__tests__/actionEconomyUtils.test.ts` | Action economy unit tests |
| `src/utils/combat/__tests__/combatAI.test.ts` | Combat AI unit tests |
| `src/hooks/__tests__/useAbilitySystem.test.ts` | Ability system hook tests |
| `src/hooks/__tests__/useCombatVisuals.test.ts` | Combat visuals hook tests |
| `src/hooks/actions/__tests__/handleMovement.test.ts` | Movement action handler tests |
| `src/systems/logic/__tests__/ConditionEvaluator.test.ts` | Condition evaluation logic tests |
| `src/utils/__tests__/aoeCalculations.test.ts` | Area of effect calculation tests |
| `src/utils/__tests__/lineOfSight.test.ts` | Line of sight calculation tests |
| `src/utils/__tests__/combatUtils_attack.test.ts` | Attack resolution utility tests |
| `src/utils/__tests__/combatUtils_character.test.ts` | Character combat utility tests |
| `src/utils/__tests__/combatUtils_cover.test.ts` | Cover calculation utility tests |
| `src/utils/__tests__/combatUtils_damage.test.ts` | Damage calculation utility tests |
| `src/utils/__tests__/combatUtils_damage_logic.test.ts` | Damage logic utility tests |
| `src/utils/__tests__/combatUtils_rollDice.test.ts` | Dice rolling utility tests |
| `src/utils/__tests__/lineOfSight.test.ts` | Line of sight calculation tests |
| `src/utils/__tests__/movementRules.test.ts` | Movement rules utility tests |
| `src/utils/__tests__/savingThrowUtils.test.ts` | Saving throw utility tests |
| `src/utils/__tests__/weaponUtils.test.ts` | Weapon utility tests |
| `src/components/ActionPane/__tests__/ActionPane.test.tsx` | Action pane component tests |
