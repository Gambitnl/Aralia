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
| `src/hooks/combat/**/*.ts` | Directory | Combat hooks |
| `src/components/Combat/*.ts*` | Directory | Combat UI and index |
| `src/components/Encounter*.tsx` | Component | Encounter modals and managers |
| `src/utils/combat/*.ts` | Utils | Combat utilities |
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
| `src/utils/combat/__tests__/actionEconomyUtils.test.ts` | Unit test |
| `src/utils/combat/__tests__/combatAI.test.ts` | Unit test |
