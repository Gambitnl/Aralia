# Gap: AI Input UI Integration

**Priority:** High  
**Status:** Open, but narrower than originally stated  
**Last Reverified:** 2026-03-11

## Verified Current State

The repo is no longer missing all input-UI surfaces.

Verified files:
- [`src/components/BattleMap/AISpellInputModal.tsx`](../../../src/components/BattleMap/AISpellInputModal.tsx)
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)

Verified behavior:
- `AISpellInputModal` exists as a real component
- `useAbilitySystem` already checks `spell.arbitrationType === 'ai_dm'`
- `useAbilitySystem` already exposes an `onRequestInput` hook for collecting player input before continuing execution

## What Still Looks Unfinished

This pass did not verify a live call site that actually renders `AISpellInputModal` during combat flow.

That means the open gap is now:
- not "there is no input UI component"
- but "the input UI wiring/proof-of-life remains unverified or incomplete"

## Why It Still Matters

Without verified wiring:
- AI-DM spells that really require player input can still fail or stall in practice
- the presence of the modal component alone does not prove the full gameplay loop works

## Current Follow-Through

1. Verify where `onRequestInput` is supplied by the parent battle/spell UI.
2. If no live wiring exists, connect the current `AISpellInputModal` component instead of inventing a new one.
3. Re-test against a spell that genuinely requires player input.
