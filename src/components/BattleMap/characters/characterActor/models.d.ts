/**
 * @file characters/characterActor/models.tsx
 * Animation state + archetype/race derivation and the procedural creature
 * models (humanoid, beast, dragon, ooze, aberration) plus the BG3-style
 * selection decal and active-turn indicator. Extracted verbatim from
 * CharacterActor.tsx.
 */
import React from 'react';
export type AnimationState = 'idle' | 'walk' | 'attack_melee' | 'attack_ranged' | 'cast_spell' | 'hit_react' | 'death';
export type CharacterArchetype = 'fighter' | 'caster' | 'rogue';
export declare function getArchetype(className: string): CharacterArchetype;
/**
 * Derives a race-specific look from the character's race (carried in
 * `creatureTypes[1]` by createPlayerCombatCharacter, falling back to the name
 * for monster-style enemies like "Orc Reaver" / "Goblin Skulker").
 *
 * Team color still owns friend/foe (armor + ground ring stay team-colored);
 * race only changes exposed skin tone, overall build, and a cheap silhouette
 * cue (dwarf beard, tiefling horns), so tactical readability is preserved while
 * a dwarf / elf / orc / tiefling no longer look identical.
 */
export interface RaceVisual {
    skin: number;
    heightScale: number;
    buildScale: number;
    horns: boolean;
    beard: boolean;
    /** Body plan — non-humanoid forms render dedicated geometry. */
    form: 'humanoid' | 'beast' | 'dragon' | 'ooze' | 'aberration';
}
export declare function getRaceVisual(creatureTypes: string[] | undefined, name: string): RaceVisual;
/**
 * A simple four-legged creature (wolf/hound/bear) so Beasts read as animals
 * rather than low humanoids. Built facing +Z to match the humanoid (the actor
 * group applies facing). The body carries the team color (friend/foe stays
 * obvious); head/legs/tail use the fur tone.
 */
export declare const BeastModel: React.FC<{
    teamColor: number;
    isPlayerTeam: boolean;
    animTime: number;
    furColor: number;
    idlePhase?: number;
}>;
/**
 * A winged, long-necked, four-legged dragon so true Dragons read as iconic
 * monsters (pair with a Large/Huge `stats.size` to make them loom). Faces +Z.
 * The body/wings carry the team color so friend/foe stays readable; scales use
 * a darker shade. Wings give a slow idle flap.
 */
export declare const DragonModel: React.FC<{
    teamColor: number;
    isPlayerTeam: boolean;
    animTime: number;
    scaleColor: number;
    idlePhase?: number;
}>;
/**
 * A low translucent wobbling blob so Oozes read as amorphous slime rather than
 * upright humanoids. The blob carries the team color (translucency keeps it
 * clearly non-armored); a darker nucleus hints at the engulfed-core look.
 */
export declare const OozeModel: React.FC<{
    teamColor: number;
    isPlayerTeam: boolean;
    animTime: number;
    slimeColor: number;
    idlePhase?: number;
}>;
/**
 * A hovering eye-orb with hanging tentacles (beholder-like) so Aberrations read
 * as alien monsters. The orb carries the team color; the great eye and
 * tentacles use the alien skin tone. Bobs slowly to sell the levitation.
 */
export declare const AberrationModel: React.FC<{
    teamColor: number;
    isPlayerTeam: boolean;
    animTime: number;
    fleshColor: number;
    idlePhase?: number;
}>;
/**
 * Class-aware humanoid shape built from primitives.
 * - Fighter: heavy armor + sword + shield
 * - Caster: flowing robes + tall staff (no shield)
 * - Rogue: hooded cowl + dual daggers (no shield)
 */
export declare const HumanoidModel: React.FC<{
    teamColor: number;
    isPlayerTeam: boolean;
    isAlive: boolean;
    animState: AnimationState;
    animTime: number;
    archetype: CharacterArchetype;
    race: RaceVisual;
    stance: {
        phase: number;
        lean: number;
        armL: number;
        armR: number;
    };
}>;
export declare const SelectionDecal: React.FC<{
    color: number;
    visible: boolean;
    pulse: boolean;
    baseOpacity?: number;
}>;
export declare const TurnIndicator: React.FC<{
    active: boolean;
}>;
