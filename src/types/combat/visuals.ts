/**
 * @file combat/visuals.ts
 * Combat animation and spell-delivery presentation payloads.
 *
 * Declarations moved unchanged from combat.ts. That file remains the public
 * compatibility entry; direct type imports here make ownership explicit.
 * Reciprocal type references are erased at runtime, not new state owners.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 24/10/2026, 21:16:06
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Position } from './primitives.js';
import type { AreaOfEffect } from './actions.js';

export interface MoveAnimationData {
  path?: Position[];
  teleport?: boolean;
}


export interface AttackAnimationData {
  targetId: string;
  weaponId?: string;
  isCrit?: boolean;
  isMiss?: boolean;
  damage?: number;
}


export interface SpellEffectAnimationData {
  spellId?: string;
  effectType?: string;
  color?: string;
  areaOfEffect?: AreaOfEffect;
  targetPositions?: Position[];
  /**
   * The hole this effect left in the ground, when it is an effect that leaves
   * one. Classified once at the point of resolution (`groundImpactOfAbility`),
   * because that is where the ability is in hand; the 3D map reads it and digs.
   * Absent on every other effect, and absent entirely on the 2D map, which has
   * no ground to dig.
   */
  groundImpact?: { radiusM: number; depthM: number };
}


export interface DamageNumberAnimationData {
  value: number;
  type: "physical" | "magical" | "heal" | "miss";
  isCrit?: boolean;
}


export interface StatusEffectAnimationData {
  statusId: string;
  action: "apply" | "remove" | "tick";
  icon?: string;
}


/**
 * Discriminated union of all possible animation data payloads.
 * Used to enforce strict typing on the `data` field of Animations.
 */
export type AnimationData =
  | MoveAnimationData
  | AttackAnimationData
  | SpellEffectAnimationData
  | DamageNumberAnimationData
  | StatusEffectAnimationData;


export interface Animation {
  id: string;
  type: "move" | "attack" | "spell_effect" | "damage_number" | "status_effect";
  characterId?: string;
  startPosition?: Position;
  endPosition?: Position;
  duration: number;
  startTime: number;
  data?: AnimationData;
}


export interface DamageNumber {
  id: string;
  value: number;
  position: Position;
  type: "damage" | "heal" | "miss" | "save" | "resist" | "immune";
  startTime: number;
  duration: number;
}


export interface SpellMovementVisual {
  id: string;
  spellId: string;
  targetId: string;
  type: "teleport" | "forced_movement";
  from: Position;
  to: Position;
  path?: Position[];
  createdAt: number;
}


export interface SpellDeliveryVisual {
  id: string;
  spellId: string;
  spellName: string;
  casterId: string;
  /**
   * Shared controlled-entity actor that delivered a touch spell.
   * Find Familiar is the current live spell using this path, but the runtime
   * permission is now actor metadata, not a familiar-only exception.
   */
  deliveryActorId: string;
  /** Backward-compatible alias for older Find Familiar visual consumers. */
  familiarId?: string;
  targetId: string;
  from: Position;
  to: Position;
  label: string;
  createdAt: number;
}


export interface CharacterPosition {
  characterId: string;
  coordinates: { x: number; y: number };
}
