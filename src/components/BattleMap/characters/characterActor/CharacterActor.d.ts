/**
 * @file characters/characterActor/CharacterActor.tsx
 * The CharacterActor component: composes the procedural models, selection /
 * turn indicators, defense + condition badges, HP pip, and nameplate into one
 * 3D combat-map actor with position interpolation and animation state.
 * Extracted verbatim from the original CharacterActor.tsx (now a facade).
 */
import React from 'react';
import { CombatCharacter } from '../../../../types/combat';
interface CharacterActorProps {
    character: CombatCharacter;
    allCharacters: CombatCharacter[];
    tileElevation: number;
    /** Sampled terrain surface height at the actor's tile center — the same
     * formula the terrain mesh is built from. Falls back to tile elevation. */
    groundY?: number;
    isSelected: boolean;
    isTurn: boolean;
    isTargetable: boolean;
    targetingMode: boolean;
    onClick: (character: CombatCharacter) => void;
    activeCharacterId?: string | null;
}
declare const CharacterActor: React.FC<CharacterActorProps>;
export default CharacterActor;
