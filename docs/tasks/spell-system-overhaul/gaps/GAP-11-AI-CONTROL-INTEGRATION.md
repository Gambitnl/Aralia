# Gap: AI Control Integration

**Status:** Open
**Priority:** Medium
**Type:** AI Logic Gap
**Source:** Analysis of `src/commands/effects/UtilityCommand.ts`

## Findings
The `UtilityCommand` allows spells like *Command* or *Turn Undead* to apply "Control Options" such as "Flee", "Grovel", or "Halt".
Currently, this command:
1. Logs a message ("Goblin flees!").
2. Applies a status effect (e.g., "Frightened" or a custom "Command: Flee" tag).
3. **Does not force the AI to act.**

The Combat AI (`src/utils/combat/combatAI.ts`) likely determines its turn by scoring actions (Attack vs Move). It does not currently check "Am I under a 'Flee' command?".
As a result, a "Turned" undead might just attack the player again on its turn, ignoring the spell entirely.

## Affected Areas
- `src/commands/effects/UtilityCommand.ts`
- `src/utils/combat/combatAI.ts`
- `src/hooks/combat/useTurnManager.ts`

## Proposed Solution
1.  **Standardize Control States:**
    Define a clear enum for AI overrides: `AI_OVERRIDE.FLEE`, `AI_OVERRIDE.GROVEL`, `AI_OVERRIDE.ATTACK_ALLY`.

2.  **Update AI Logic:**
    In the AI's "Plan Turn" phase:
    ```typescript
    if (character.hasCondition('Command: Flee')) {
        return generateFleeAction(character, enemies);
    }
    if (character.hasCondition('Command: Grovel')) {
        return endTurn(); // Or drop prone action
    }
    ```

3.  **Link UtilityCommand:**
    Ensure `UtilityCommand` applies these standardized conditions in a way the AI parser recognizes (not just a text description).

## Acceptance Criteria
- [ ] AI respects "Flee" (moves away from source).
- [ ] AI respects "Halt" (does nothing).
- [ ] AI respects "Grovel" (drops prone, ends turn).
