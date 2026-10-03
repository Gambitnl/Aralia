/**
 * @file characters/characterActor/models.tsx
 * The actor primitives that are STILL DRAWN: the animation-state union, the
 * BG3-style selection decal, and the active-turn indicator.
 *
 * The box-primitive creature models and their archetype/race derivation were
 * retired 2026-09-20 (task agora-b8b9) once `./EntityModel` had replaced them
 * on both the WebGL and the WebGPU actor; see models.tsx for the full note.
 */
import React from 'react';
export type AnimationState = 'idle' | 'walk' | 'attack_melee' | 'attack_ranged' | 'cast_spell' | 'hit_react' | 'death';
export declare const SelectionDecal: React.FC<{
    color: number;
    visible: boolean;
    pulse: boolean;
    baseOpacity?: number;
}>;
export declare const TurnIndicator: React.FC<{
    active: boolean;
}>;
