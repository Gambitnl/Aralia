# Gap: Missing AI Input UI

**Priority:** Critical
**Status:** Open
**Detected:** Dec 2025 (Agent Epsilon Review)

## Findings
During the review of the AI Arbitration System, I scanned the frontend codebase (`src/components/`) for usage of `playerInput` or `ai_dm` handling.
- **Search Command:** `grep -r "playerInput" src/components` returned **0 results**.
- **Search Command:** `grep -r "ai_dm" src/components` returned **0 results**.

## The Problem
The backend `AISpellArbitrator` is designed to accept a `playerInput` string for Tier 3 spells (e.g., "I suggest the guard let us pass"). However, the UI currently treats all spellcasts as mechanical clicks. There is no mechanism to prompt the user for this text input.

**Consequence:**
- Casting a Tier 3 spell will likely send `undefined` as input.
- The `AISpellArbitrator` will return `{ allowed: false, reason: 'Player input required' }`.
- The spell will fail silently or with a generic error, making AI spells unusable.

## Proposed Solution
Implement a modal or prompt system that intercepts the cast action for `ai_dm` spells.

### 1. New Component: `AISpellInputModal`
Create a modal that appears when a spell requires input.
- **Props:** `spell: Spell`, `onConfirm: (text: string) => void`, `onCancel: () => void`.
- **UI:** Textarea for the player to describe their intent (e.g., "What do you want to suggest?").

### 2. Integration: `useAbilitySystem` or `CombatView`
Hook into the spell selection/targeting flow.
- When `onAbilityUse` is triggered:
    1. Check if `spell.arbitrationType === 'ai_dm'`.
    2. If yes, stop mechanical execution.
    3. Show `AISpellInputModal`.
    4. On confirm, pass the text string to `useGameActions` -> `castSpell`.

## Dependencies
- `src/systems/spells/ai/AISpellArbitrator.ts` (Backend is ready).
- `src/types/spells.ts` (Types are ready).
