# Gap: Concentration-Effect Link

**Status:** Open
**Priority:** High
**Type:** Architecture Gap
**Source:** Code Review of `src/commands/effects/ConcentrationCommands.ts`

## Findings
The `StartConcentrationCommand` correctly sets the `concentratingOn` state on the caster, but it has a specific TODO:
```typescript
effectIds: [], // TODO: Future integration points for tracking specific effect IDs (buffs/debuffs)
```
Currently, when a spell like *Bless* or *Bane* creates status effects on targets, those Effect IDs are not passed back to the Concentration system.

**Consequence:**
When `BreakConcentrationCommand` executes:
1. It clears the caster's `concentratingOn` flag.
2. It removes "Attack Riders" (via `AttackRiderSystem`).
3. **IT DOES NOT REMOVE** Status Conditions (Buffs/Debuffs) on targets.

This means if a Cleric casts *Bless*, then gets hit and loses concentration, the *Bless* effect remains on the party until its duration expires naturally (1 minute). This breaks 5e rules.

## Affected Areas
- `src/commands/effects/ConcentrationCommands.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- All Concentration spells (*Bless*, *Bane*, *Hold Person*, *Haste*, etc.)

## Proposed Solution
1.  **Capture IDs in Factory:**
    Update `SpellCommandFactory` to capture the IDs of effects created by `StatusConditionCommand` (and others).
    *   This is tricky because Commands are *created* before they are *executed*, and IDs are often generated *during* execution.
    *   **Alternative:** Pass a pre-generated ID to the command constructor.

2.  **Pass IDs to Concentration:**
    Modify the flow so that `StartConcentrationCommand` receives the list of IDs it is responsible for.
    *   *Challenge:* `StartConcentration` usually runs *before* or *parallel* to the effects?
    *   *Better Approach:* Use a "RegisterConcentrationEffect" command *after* the effects are applied?
    *   *Or:* Pre-generate UUIDs in the Factory and pass them to both the EffectCommand (to use) and the ConcentrationCommand (to track).

3.  **Implement Break Logic:**
    Update `BreakConcentrationCommand` to iterate `concentratingOn.effectIds` and dispatch a `RemoveEffect` action for each.

## Acceptance Criteria
- [ ] `SpellCommandFactory` pre-generates IDs for concentration effects.
- [ ] `StartConcentrationCommand` stores these IDs.
- [ ] `BreakConcentrationCommand` removes the linked effects from all targets.
- [ ] Integration test: *Bless* falls off when concentration breaks.
