# Improvement Note: Remove Obsolete Files

## Status

This improvement is already materially complete.
The file is preserved as a historical completion note, not as an active cleanup instruction set.

## Verified Outcome

The files this note targeted were checked on 2026-03-11 and were not found at their old paths:

- `src/components/PlayerPane.tsx`
- `src/components/StartScreen.tsx`
- `src/components/Spellbook.tsx`
- `src/battleMapDemo.tsx`
- `src/components/CharacterCreator/Race/FlexibleAsiSelection.tsx`
- `src/hooks/OLD_useGameActions.ts`

The paired README targets named in the old plan are also no longer present at the paths this note called obsolete.

## What This Means

- this file should not be used as a live deletion checklist
- the targeted cleanup already happened earlier in the repo's evolution
- any future cleanup work should be based on fresh repo verification, not by replaying this file blindly

## Preserved Historical Value

This note is still useful as provenance for why those older surfaces disappeared:

- `PlayerPane` gave way to the party / character-sheet surfaces
- `StartScreen` gave way to the main menu flow
- the old `Spellbook` surface gave way to the newer spellbook overlay direction
- the legacy backup hook and older race-selection component are no longer part of the active creation flow

## Follow-Through

No deletion work remains from this note itself.
If this area is normalized later, this file can be moved into a completed or archive lane without losing its provenance value.
