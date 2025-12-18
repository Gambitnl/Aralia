# Necromancy System

## Overview
This directory contains the framework for handling **Corpses** and **Undead Creation**.
Currently, the core engine treats dead creatures simply as `CombatCharacter`s with 0 HP.
This system introduces the `Corpse` model, which acts as a bridge between a character's death and their use as a resource (spell component) or their resurrection.

## Models
* `Corpse`: Represents the physical remains. Holds a snapshot of the original character.
* `CorpseState`: Tracks decay (`fresh`, `bones`, etc.).

## Usage
When a character dies in `useTurnManager`, the system should:
1. Call `createCorpse(character, currentTurn)`.
2. Add the resulting `Corpse` to a new `corpses` collection in `CombatState`.
3. (Optionally) Remove the `CombatCharacter` from the `characters` array or hide them.

Spells like *Animate Dead* will then target these `Corpse` objects instead of `CombatCharacter`s.

## Future Integration
* Update `CombatState` to include `corpses: Corpse[]`.
* Update `TargetResolver` to allow targeting `Corpse` objects.
* Update `Animate Dead` spell JSON to use a special `targetType: "corpse"`.
