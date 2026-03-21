# Improvement Note: Refactor PlayerCharacter Type For Scalability

## Status

This is now a preserved completion note.
The scalable racial-selection refactor it describes is materially present in the current repo, but the older note points at an outdated file layout.

## Verified Current State

- `src/types/character.ts` contains the live `PlayerCharacter` model.
- That model now carries `racialSelections` instead of relying only on one bespoke property per race choice.
- `src/components/CharacterCreator/state/characterCreatorState.ts` uses the shared racial-selection structure.
- `src/components/CharacterCreator/hooks/useCharacterAssembly.ts` and related character-creator surfaces consume that shared structure.
- The generic racial spell ability component exists and participates in the modernized selection flow.

## Historical Drift To Note

The older note referred to `src/types.ts` as the primary target.
That is no longer the live type home for this work.
The current repo organizes these types under `src/types/`, with the relevant character model living in `src/types/character.ts`.

So the file's architectural goal was right, but its exact target path is now historical.

## What This Means

- the core scalability refactor was completed
- this file should not remain framed as an active implementation checklist
- it is still useful as provenance for why racial choice data became generic and centralized

## Preserved Value

This note still captures an important principle that remains valid:

- character data should scale through shared structures
- adding a new race should not require bloating the core character type with another one-off field
- type cleanliness and future extensibility were both improved by converging on `racialSelections`
