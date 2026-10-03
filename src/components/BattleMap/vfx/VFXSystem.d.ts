/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 05:50:27
 * Dependents: components/BattleMap/vfx/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file VFXSystem.tsx
 * Combat visual effects system for the 3D battle map.
 *
 * Manages all dynamic combat visuals:
 * - Spell zone ground effects (fire, ice, acid, etc.)
 * - Weapon trails during melee attacks
 * - Projectile particles for ranged attacks
 * - Impact effects (sparks, blood decals)
 * - Dynamic point lights during spell effects
 * - Damage number float-up overlays
 * - AoE targeting preview shapes
 *
 * Philosophy: "world-space drama, screen-space restraint" (BG3 style)
 * — dramatic in-world effects, no full-screen flashes or excessive shake.
 *
 * Research references:
 * - Three.js particle systems: https://threejs.org/examples/#webgl_points_sprites
 * - R3F trail/ribbon mesh: Three.js TubeGeometry from point history
 * - BG3 VFX reference: design spec screenshots
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "VFX System" section
 */
import React from 'react';
import { BattleMapData, CombatCharacter, LightLevel, LightSource, type DamageNumber as CombatDamageNumber, type Position, type SpellDeliveryVisual, type SpellMovementVisual } from '../../../types/combat';
import { type ActiveSpellZone, type MovementTriggerDebuff, type ScheduledSpellEffect } from '../../../systems/spells/effects/triggerHandler';
export interface TileVisibilityOverlay {
    id: string;
    position: Position;
    color: string;
    opacity: number;
}
/**
 * Build the 3D tile masks that communicate tactical visibility.
 *
 * This helper is exported so tests can prove hidden/dim/dark tile decisions
 * without mounting a WebGL canvas. The renderer below only turns these plain
 * overlay records into Three.js meshes.
 */
export declare const buildTileVisibilityOverlays: (mapData: BattleMapData, lightLevels?: Map<string, LightLevel>, visibleTiles?: Set<string>) => TileVisibilityOverlay[];
interface VFXSystemProps {
    mapData: BattleMapData;
    characters: CombatCharacter[];
    /** Active structured spell zones shared with the 2D combat-map overlay. */
    spellZones?: ActiveSpellZone[];
    /** Target-bound delayed spell effects shared with the 2D combat-map overlay. */
    scheduledSpellEffects?: ScheduledSpellEffect[];
    /** Target-bound movement punishments shared with the 2D combat-map overlay. */
    movementDebuffs?: MovementTriggerDebuff[];
    /** Live light sources shared with visibility and the 2D combat-map overlay. */
    activeLightSources?: LightSource[];
    /** Tile light levels calculated from live light sources. */
    lightLevels?: Map<string, LightLevel>;
    /** Tiles currently visible to the chosen observer. */
    visibleTiles?: Set<string>;
    /** Floating damage/heal/miss feedback shared with the 2D combat-map overlay. */
    damageNumbers?: CombatDamageNumber[];
    /** Resolved forced-movement and teleport cues shared with the 2D combat-map overlay. */
    spellMovementVisuals?: SpellMovementVisual[];
    /** Controlled-entity touch delivery cues shared with the 2D combat-map overlay. */
    spellDeliveryVisuals?: SpellDeliveryVisual[];
    /** Teleport destination candidates from the targeting system. */
    teleportDestinationPreviewTiles?: Set<string>;
    /** Current creature whose teleport destination is being assigned. */
    teleportDestinationPreviewTarget?: CombatCharacter;
    /** Current teleport spell name for active assignment labels. */
    teleportDestinationPreviewAbilityName?: string;
    /** Destinations already chosen during a multi-target teleport assignment. */
    assignedTeleportDestinations?: Array<{
        targetId: string;
        targetName: string;
        destination: Position;
        abilityName: string;
    }>;
    /** Whether currently in targeting mode */
    targetingMode?: boolean;
}
declare const VFXSystem: React.FC<VFXSystemProps>;
export default VFXSystem;
