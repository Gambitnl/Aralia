// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 09:59:36
 * Dependents: components/BattleMap/vfx/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file VFXSystem.tsx
 * Combat visual effects system for the 3D battle map — CONTAINER.
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
 * SPLIT (task agora-b70d, 2026-09-09): this file was 1211 lines holding every
 * effect component, every derivation, and every inline label. It is now the
 * container only — props, memoized derivations, and scene mounting — and the
 * effects live in four sibling modules grouped by responsibility:
 *
 * - `./particleEmitters`     pure particle buffer creation + per-frame stepping
 * - `./spellEffects`         spell zones, movement/delivery cues, teleport pads
 * - `./combatFeedback`       damage numbers, hit sparks, trails, creature badges
 * - `./environmentEffects`   visibility masks, light-source glows
 * - `./vfxConstants`         TILE_SIZE + tile-center placement (leaf module)
 *
 * Nothing was removed. `WeaponTrail` / `ImpactEffect` / `BloodDecal` were
 * already built-but-unmounted before the split and stay that way in
 * `./combatFeedback` — see that file's header for why they are preserved.
 * `buildTileVisibilityOverlays`, `TileVisibilityOverlay`, and
 * `LIGHT_SOURCE_MARKER_HTML_PROPS` are re-exported below because existing
 * callers and tests import them from this path.
 *
 * Research references:
 * - Three.js particle systems: https://threejs.org/examples/#webgl_points_sprites
 * - R3F trail/ribbon mesh: Three.js TubeGeometry from point history
 * - BG3 VFX reference: design spec screenshots
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "VFX System" section
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  BattleMapData,
  CombatCharacter,
  LightLevel,
  LightSource,
  type DamageNumber as CombatDamageNumber,
  type SpellDeliveryVisual,
  type SpellMovementVisual,
} from '../../../types/combat';
import {
  type ActiveSpellZone,
  type MovementTriggerDebuff,
  type ScheduledSpellEffect,
} from '../../../systems/spells/effects/triggerHandler';
import { TILE_SIZE } from './vfxConstants';
import {
  AssignedTeleportDestinationMarker,
  SpellDeliveryVisualCue,
  SpellMovementVisualCue,
  SpellZoneEffect,
  TeleportAssignmentLabel,
  TeleportDestinationPreview,
  buildSpellZoneTileEffects,
  collectTileEnvironmentalEffects,
  type AssignedTeleportDestination,
} from './spellEffects';
import {
  CreatureStateBadge,
  DamageNumber,
  TargetBoundSpellBadge,
  buildCreatureStateMarkers,
  buildTargetBoundSpellMarkers,
} from './combatFeedback';
import {
  AmbientWeather,
  LightSourceVisual,
  TileVisibilityMasks,
  buildLightSourceMarkers,
  buildTileVisibilityOverlays,
} from './environmentEffects';

/* Backward-compatible surface. These three were exported from this file before
 * the split; `vfx/__tests__/VFXSystem.visibility.test.ts` imports two of them
 * from here. Re-exporting keeps every caller working while the definitions
 * live with the renderer that uses them. */
export {
  LIGHT_SOURCE_MARKER_HTML_PROPS,
  buildTileVisibilityOverlays,
  type TileVisibilityOverlay,
} from './environmentEffects';

// ---------------------------------------------------------------------------
// Main VFX System component
// ---------------------------------------------------------------------------

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
  assignedTeleportDestinations?: AssignedTeleportDestination[];
  /** Whether currently in targeting mode */
  targetingMode?: boolean;
}

const VFXSystem: React.FC<VFXSystemProps> = ({
  mapData,
  characters,
  spellZones = [],
  scheduledSpellEffects = [],
  movementDebuffs = [],
  activeLightSources = [],
  lightLevels,
  visibleTiles,
  damageNumbers = [],
  spellMovementVisuals = [],
  spellDeliveryVisuals = [],
  teleportDestinationPreviewTiles,
  teleportDestinationPreviewTarget,
  teleportDestinationPreviewAbilityName,
  assignedTeleportDestinations = [],
  targetingMode,
}) => {
  // Environmental effects the map tiles already carry.
  const activeEffects = useMemo(() => collectTileEnvironmentalEffects(mapData), [mapData]);

  // Structured spell zones converted into the same per-tile visual payload, so
  // the 3D view shows the same active areas as the 2D map without duplicating
  // the actual spell execution state.
  const activeSpellZoneEffects = useMemo(
    () => buildSpellZoneTileEffects(mapData, spellZones),
    [mapData, spellZones]
  );

  // "This creature is carrying a trigger" badges for delayed and
  // movement-triggered spell state.
  const targetBoundSpellMarkers = useMemo(
    () => buildTargetBoundSpellMarkers(characters, scheduledSpellEffects, movementDebuffs),
    [characters, movementDebuffs, scheduledSpellEffects]
  );

  // Concentration / status / rider badges, driven directly from character state
  // so concentration cleanup clears the labels at the same time it clears the
  // underlying statuses.
  const creatureStateMarkers = useMemo(
    () => buildCreatureStateMarkers(characters),
    [characters]
  );

  // Structured light sources resolved to world positions.
  const lightSourceMarkers = useMemo(
    () => buildLightSourceMarkers(activeLightSources, characters),
    [activeLightSources, characters]
  );

  // Tile visibility overlays are deliberately separate from light-source glows.
  // Glows show where light originates; these masks show what the active viewer
  // can actually see after visibility rules are applied.
  const tileVisibilityOverlays = useMemo(
    () => buildTileVisibilityOverlays(mapData, lightLevels, visibleTiles),
    [lightLevels, mapData, visibleTiles]
  );

  return (
    <group>
      {/* Spell zone ground effects */}
      {[...activeEffects, ...activeSpellZoneEffects].map((ae) => (
        <SpellZoneEffect
          key={`zone-${ae.tileX}-${ae.tileY}-${ae.effect.id}`}
          tileX={ae.tileX}
          tileY={ae.tileY}
          effect={ae.effect}
        />
      ))}

      {/* Live light-source glows */}
      {lightSourceMarkers.map(({ source, position }) => (
        <LightSourceVisual key={`light-${source.id}`} source={source} position={position} />
      ))}

      {/* Tactical visibility masks — one InstancedMesh per (color, opacity)
          class instead of a mesh+draw-call per tile (collapses ~thousands of
          draw calls to at most four on large, sparsely-lit maps). */}
      <TileVisibilityMasks overlays={tileVisibilityOverlays} />

      {/* Biome-driven ambient weather (rain / snow / dust / spores). One
          <points> and one draw call; roofed biomes (cave, dungeon) resolve to
          null and render nothing. The field is seeded off mapData.seed, so a
          board's weather is the same every time it is opened. */}
      <AmbientWeather mapData={mapData} />

      {/* Teleport destination preview */}
      {targetingMode && teleportDestinationPreviewTiles && teleportDestinationPreviewTiles.size > 0 && (
        <TeleportDestinationPreview tiles={teleportDestinationPreviewTiles} />
      )}

      {/* Active teleport assignment label */}
      {targetingMode && teleportDestinationPreviewTarget && teleportDestinationPreviewAbilityName && (
        <TeleportAssignmentLabel target={teleportDestinationPreviewTarget} />
      )}

      {/* Chosen teleport destinations during multi-target assignment */}
      {assignedTeleportDestinations.map((assignment) => (
        <AssignedTeleportDestinationMarker
          key={`assigned-teleport-${assignment.targetId}`}
          assignment={assignment}
        />
      ))}

      {/* Floating combat feedback from the shared turn manager. This keeps the
          3D view at parity with the 2D overlay for spell damage, healing, and
          miss-style outcomes without creating a separate visual state model. */}
      {damageNumbers.map(damageNumber => (
        <DamageNumber
          key={damageNumber.id}
          position={new THREE.Vector3(
            damageNumber.position.x * TILE_SIZE + TILE_SIZE / 2,
            1.4,
            damageNumber.position.y * TILE_SIZE + TILE_SIZE / 2
          )}
          amount={damageNumber.value}
          damageType={damageNumber.type}
          durationMs={damageNumber.duration}
          onComplete={() => undefined}
        />
      ))}

      {/* Controlled-entity touch-delivery origin cues */}
      {spellDeliveryVisuals.map(visual => (
        <SpellDeliveryVisualCue key={visual.id} visual={visual} />
      ))}

      {/* Resolved forced-movement and teleport cues */}
      {spellMovementVisuals.map(visual => (
        <SpellMovementVisualCue key={visual.id} visual={visual} />
      ))}

      {/* Creature-attached status, concentration, and rider markers */}
      {creatureStateMarkers.map(marker => (
        <CreatureStateBadge key={marker.id} marker={marker} />
      ))}

      {/* Target-bound delayed and movement-triggered spell markers */}
      {targetBoundSpellMarkers.map((marker, index) => (
        <TargetBoundSpellBadge key={marker.id} marker={marker} index={index} />
      ))}
    </group>
  );
};

export default VFXSystem;
