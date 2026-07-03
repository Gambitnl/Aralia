// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 04:53:15
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/index.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useState } from 'react';
import type { Ability, Animation, BattleMapData, CombatCharacter, DamageNumber, LightSource, Position, SpellDeliveryVisual, SpellEffectAnimationData, SpellMovementVisual } from '../../types/combat';
import DamageNumberOverlay from './DamageNumberOverlay';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import { hasLineOfSight } from '../../utils/spatial/lineOfSight';
import { Z_INDEX } from '../../styles/zIndex';
import { UI_ID } from '../../styles/uiIds';
import { buildSpellMapArtifactMarkers, type SpellMapArtifacts } from './spellMapArtifacts';
import {
  isPositionInArea,
  type ActiveSpellZone,
  type MovementTriggerDebuff,
  type ScheduledSpellEffect
} from '../../systems/spells/effects/triggerHandler';

type ZoneVisualFamily = 'fire' | 'ice' | 'poison' | 'difficult_terrain' | 'web' | 'fog';

const ZONE_VISUAL_STYLES: Record<ZoneVisualFamily, {
  className: string;
  label: string;
}> = {
  fire: {
    className: 'border-orange-200/60 bg-orange-500/18 shadow-[inset_0_0_16px_rgba(249,115,22,0.34)]',
    label: 'fire zone'
  },
  ice: {
    className: 'border-sky-200/60 bg-sky-300/18 shadow-[inset_0_0_16px_rgba(56,189,248,0.34)]',
    label: 'ice zone'
  },
  poison: {
    className: 'border-lime-200/60 bg-lime-400/16 shadow-[inset_0_0_16px_rgba(132,204,22,0.34)]',
    label: 'poison zone'
  },
  difficult_terrain: {
    className: 'border-stone-200/50 bg-amber-900/18 shadow-[inset_0_0_14px_rgba(120,53,15,0.32)]',
    label: 'difficult terrain zone'
  },
  web: {
    className: 'border-slate-100/60 bg-slate-200/16 shadow-[inset_0_0_14px_rgba(226,232,240,0.32)]',
    label: 'restraining zone'
  },
  fog: {
    className: 'border-cyan-200/40 bg-cyan-300/10 shadow-[inset_0_0_14px_rgba(34,211,238,0.22)]',
    label: 'obscuring zone'
  }
};

const getZoneVisualFamily = (zone: ActiveSpellZone): ZoneVisualFamily => {
  // Active zones preserve their original spell effects. Use those declarations
  // to pick a visual family so the board shows "fire field" versus "fog/web"
  // instead of treating every persistent spell area as the same cyan square.
  for (const effect of zone.effects) {
    if (effect.type === 'DAMAGE') {
      const damageType = effect.damage.type;
      if (damageType === 'fire') return 'fire';
      if (damageType === 'cold') return 'ice';
      if (damageType === 'poison' || damageType === 'acid') return 'poison';
    }

    if (effect.type === 'TERRAIN') {
      if (effect.terrainType === 'difficult') return 'difficult_terrain';
      if (effect.terrainType === 'obscuring') return 'fog';
      if (effect.terrainType === 'blocking' || effect.terrainType === 'wall') return 'web';
      if (effect.damage?.type === 'fire') return 'fire';
      if (effect.damage?.type === 'cold') return 'ice';
      if (effect.damage?.type === 'poison' || effect.damage?.type === 'acid') return 'poison';
    }

    if (effect.type === 'STATUS_CONDITION') {
      const statusName = effect.statusCondition.name.toLowerCase();
      if (statusName.includes('restrained') || statusName.includes('grappled')) return 'web';
      if (statusName.includes('blinded')) return 'fog';
      if (statusName.includes('poisoned')) return 'poison';
    }
  }

  return 'fog';
};

const getOverlayStatusEffectIcon = (effect: CombatCharacter['statusEffects'][number]): string => {
  if (effect.icon) return effect.icon;
  switch (effect.type) {
    case 'buff':
      return '+';
    case 'debuff':
      return '!';
    case 'dot':
      return 'DOT';
    case 'hot':
      return 'HOT';
    default:
      return '?';
  }
};

interface BattleMapOverlayProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  damageNumbers: DamageNumber[];
  animations: Animation[];
  /** Active structured spell zones that should remain visible after targeting preview ends. */
  spellZones?: ActiveSpellZone[];
  /** Target-bound delayed spell effects that are waiting for a future turn timing. */
  scheduledSpellEffects?: ScheduledSpellEffect[];
  /** Target-bound movement punishments that are waiting for the target to move. */
  movementDebuffs?: MovementTriggerDebuff[];
  /** Live light-source records created by structured utility spells. */
  activeLightSources?: LightSource[];
  /** Whether the map should draw bright/dim sight radius markers for active light sources. */
  showLightSourceMarkers?: boolean;
  /** Whether the map should draw a live line-of-sight cone for the active actor. */
  showLineOfSightCone?: boolean;
  /** Character id used as the origin for the line-of-sight cone. */
  lineOfSightOriginCharacterId?: string | null;
  /** Resolved forced-movement and teleport cues created by structured spell payloads. */
  spellMovementVisuals?: SpellMovementVisual[];
  /** Controlled-entity touch spell delivery cues. */
  spellDeliveryVisuals?: SpellDeliveryVisual[];
  /** Non-creature summon/control records that need explicit map markers. */
  spellMapArtifacts?: SpellMapArtifacts;
  aoePreview?: { center: { x: number; y: number }; affectedTiles: { x: number; y: number }[]; ability: Ability } | null;
  /** Active teleport destination-pick state; labels which creature the blue destination tiles belong to. */
  teleportDestinationPreview?: { targetId: string; affectedTiles: { x: number; y: number }[]; ability: Ability } | null;
  /** Destinations already chosen during a multi-target teleport assignment. */
  assignedTeleportDestinations?: Array<{ targetId: string; targetName: string; destination: Position; abilityName: string }>;
}

/**
 * Layered overlay for the tactical map. Aggregates floating numbers, buff/debuff
 * badges, spell cues, and AoE previews using lightweight CSS transitions to
 * avoid expensive animation libraries.
 * 
 * CURRENT FUNCTIONALITY:
 * - Renders damage numbers with CSS transitions
 * - Displays status effect badges above character tokens
 * - Shows spell effect animations and AoE previews
 * - Uses requestAnimationFrame for smooth transitions
 * - Manages active/inactive animation states
 * 
 * PERFORMANCE OPPORTUNITIES:
 * - Individual DOM elements for each status effect badge
 * - Damage numbers use separate divs instead of canvas batching
 * - Spell animations create multiple elements per effect
 * - No virtualization for large numbers of effects
 * - Position calculations repeated for overlapping elements
 */
const BattleMapOverlay: React.FC<BattleMapOverlayProps> = ({
  mapData,
  characters,
  damageNumbers,
  animations,
  spellZones = [],
  scheduledSpellEffects = [],
  movementDebuffs = [],
  activeLightSources = [],
  showLightSourceMarkers = true,
  showLineOfSightCone = false,
  lineOfSightOriginCharacterId = null,
  spellMovementVisuals = [],
  spellDeliveryVisuals = [],
  spellMapArtifacts,
  aoePreview,
  teleportDestinationPreview,
  assignedTeleportDestinations = [],
}) => {
  type SpellEffectOverlayData = SpellEffectAnimationData & { targetPosition?: Position };
  const spellAnimations = animations.filter(anim => anim.type === 'spell_effect');
  const [activeSpells, setActiveSpells] = useState<Record<string, boolean>>({});

  // Active zones are persistent gameplay objects, not just cast previews. The
  // overlay derives covered tiles from the same area containment helper used by
  // trigger processing so what the player sees matches what the runtime checks.
  const activeZoneTiles = spellZones.flatMap(zone => {
    if (!zone.areaOfEffect) return [];
    const visualFamily = getZoneVisualFamily(zone);

    return Array.from(mapData.tiles.values())
      .filter(tile => isPositionInArea(tile.coordinates, zone.position, zone.areaOfEffect!, zone.direction))
      .map(tile => ({ zone, position: tile.coordinates, visualFamily }));
  });

  // Target-bound spell state is different from an area zone: it belongs to a
  // creature rather than a tile template. Mark the target's tile so players can
  // see which combatants are carrying delayed start/end-turn effects or
  // movement-triggered punishments before those triggers resolve.
  const targetBoundSpellMarkers = [
    ...scheduledSpellEffects.map(effect => ({
      id: `scheduled-${effect.id}`,
      targetId: effect.targetId,
      label: 'DELAY',
      title: `${effect.spellId} resolves on ${effect.timing.replace('_', ' ')}`
    })),
    ...movementDebuffs.map(debuff => ({
      id: `movement-${debuff.id}`,
      targetId: debuff.targetId,
      label: 'MOVE',
      title: `${debuff.spellId} triggers if this target moves`
    }))
  ].flatMap(marker => {
    const target = characters.find(character => character.id === marker.targetId);
    return target ? [{ ...marker, position: target.position }] : [];
  });

  // Attack riders are caster-owned runtime effects, but target-specific riders
  // like Hex matter to the creature being threatened. Show them on the target
  // tile when possible, otherwise on the caster, so concentration cleanup has a
  // visible 2D map artifact that disappears with the underlying rider state.
  const riderSpellMarkers = characters.flatMap(caster => (
    (caster.riders || []).map((rider, index) => {
      const target = rider.targetId
        ? characters.find(character => character.id === rider.targetId)
        : null;
      const markerOwner = target ?? caster;

      return {
        id: `rider-${caster.id}-${rider.id}`,
        position: markerOwner.position,
        label: 'RIDER',
        title: `${rider.sourceName} rider from ${caster.name}`,
        offset: index
      };
    })
  ));

  const activeTeleportTarget = teleportDestinationPreview
    ? characters.find(character => character.id === teleportDestinationPreview.targetId)
    : null;

  // Light-source commands store attachment metadata rather than direct render
  // coordinates. Resolve each light back to its current map position so moving
  // casters/targets carry their glow and concentration cleanup removes the glow
  // by removing the source record.
  const lightSourceMarkers = activeLightSources.flatMap(source => {
    const attachedCharacter = source.attachedToCharacterId
      ? characters.find(character => character.id === source.attachedToCharacterId)
      : null;
    const caster = characters.find(character => character.id === source.casterId);
    const position = attachedCharacter?.position || source.position || caster?.position;
    if (!position) return [];
    return [{ source, position }];
  });

  // Non-creature summon and control records are not combatants, so they need
  // their own map artifact path instead of relying on CharacterToken rendering.
  const spellArtifactMarkers = buildSpellMapArtifactMarkers(spellMapArtifacts, characters);

  // The LoS cone is a teaching overlay only: it asks the real line-of-sight
  // helper which tiles are actually visible from the active actor, then clips
  // that result into a forward-facing wedge so blockers and firing lanes read
  // as a "cone" without changing gameplay targeting rules.
  const lineOfSightConeTiles = (() => {
    if (!showLineOfSightCone || !lineOfSightOriginCharacterId) return [];

    const originCharacter = characters.find(character => character.id === lineOfSightOriginCharacterId);
    if (!originCharacter) return [];

    const originTile = mapData.tiles.get(`${originCharacter.position.x}-${originCharacter.position.y}`);
    if (!originTile) return [];

    const hostileTargets = characters.filter(character => (
      character.id !== originCharacter.id
      && character.team
      && originCharacter.team
      && character.team !== originCharacter.team
    ));
    const focusTarget = hostileTargets[0] ?? characters.find(character => character.id !== originCharacter.id);
    const focusVector = focusTarget
      ? {
          x: focusTarget.position.x - originCharacter.position.x,
          y: focusTarget.position.y - originCharacter.position.y
        }
      : { x: 1, y: 0 };
    const focusLength = Math.hypot(focusVector.x, focusVector.y) || 1;
    const normalizedFocus = {
      x: focusVector.x / focusLength,
      y: focusVector.y / focusLength
    };
    const coneRangeTiles = 12;
    const coneHalfAngleCosine = Math.cos(Math.PI / 4);

    return Array.from(mapData.tiles.values()).filter(tile => {
      const vector = {
        x: tile.coordinates.x - originCharacter.position.x,
        y: tile.coordinates.y - originCharacter.position.y
      };
      const distance = Math.hypot(vector.x, vector.y);
      if (distance <= 0 || distance > coneRangeTiles) return false;

      const dot = ((vector.x / distance) * normalizedFocus.x) + ((vector.y / distance) * normalizedFocus.y);
      if (dot < coneHalfAngleCosine) return false;

      return hasLineOfSight(originTile, tile, mapData);
    });
  })();

  useEffect(() => {
    const newIds: string[] = [];
    spellAnimations.forEach(anim => {
      if (!activeSpells[anim.id]) newIds.push(anim.id);
    });

    if (newIds.length) {
      requestAnimationFrame(() => {
        setActiveSpells(prev => {
          const next = { ...prev };
          newIds.forEach(id => {
            next[id] = true;
          });
          return next;
        });
      });
    }
  }, [spellAnimations, activeSpells]);

  return (
    <div
      id={UI_ID.BATTLE_MAP_OVERLAY}
      data-testid={UI_ID.BATTLE_MAP_OVERLAY}
      className="pointer-events-none absolute inset-0"
      style={{
        width: mapData.dimensions.width * TILE_SIZE_PX,
        height: mapData.dimensions.height * TILE_SIZE_PX,
        zIndex: Z_INDEX.MINIMAP,
      }}
    >
      {/* Floating damage/heal numbers */}
      <DamageNumberOverlay damageNumbers={damageNumbers} />

      {/* Live light-source radius markers */}
      {showLightSourceMarkers && lightSourceMarkers.map(({ source, position }) => {
        const brightTiles = Math.max(0.25, source.brightRadius / 5);
        const totalTiles = Math.max(brightTiles, (source.brightRadius + source.dimRadius) / 5);
        const centerX = position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const centerY = position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        return (
          <React.Fragment key={`light-${source.id}`}>
            <div
              className="absolute rounded-full border border-amber-100/30 bg-amber-200/8"
              title={`${source.sourceSpellId} dim light (${source.dimRadius} ft)`}
              style={{
                left: centerX - totalTiles * TILE_SIZE_PX,
                top: centerY - totalTiles * TILE_SIZE_PX,
                width: totalTiles * TILE_SIZE_PX * 2,
                height: totalTiles * TILE_SIZE_PX * 2,
                boxShadow: '0 0 24px rgba(251, 191, 36, 0.20)',
                zIndex: Z_INDEX.CONTENT_OVERLAY_LOW,
              }}
            />
            <div
              className="absolute rounded-full border border-yellow-100/50 bg-yellow-200/14"
              title={`${source.sourceSpellId} bright light (${source.brightRadius} ft)`}
              style={{
                left: centerX - brightTiles * TILE_SIZE_PX,
                top: centerY - brightTiles * TILE_SIZE_PX,
                width: brightTiles * TILE_SIZE_PX * 2,
                height: brightTiles * TILE_SIZE_PX * 2,
                boxShadow: '0 0 18px rgba(253, 224, 71, 0.28)',
                zIndex: Z_INDEX.CONTENT_OVERLAY_LOW,
              }}
            />
            <div
              className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-yellow-100/80 bg-amber-400/95 text-[11px] font-black leading-none text-amber-950 shadow-[0_0_16px_rgba(251,191,36,0.65)]"
              title={`${source.sourceSpellId} light source`}
              style={{
                left: centerX,
                top: centerY,
                zIndex: Z_INDEX.CONTENT_OVERLAY_LOW + 1,
              }}
            >
              {/* This marker names the source of the radius circles. Without a
                  center point, teaching scenarios show bright/dim areas but do
                  not explain what object is producing the light. */}
              ✦
            </div>
          </React.Fragment>
        );
      })}

      {/* Live line-of-sight cone. This stays separate from light radii so the
          scenario can inspect sight lanes without hiding the torch's circles. */}
      {lineOfSightConeTiles.map(tile => (
        <div
          key={`los-cone-${tile.id}`}
          className="absolute border border-cyan-200/45 bg-cyan-300/16 shadow-[inset_0_0_12px_rgba(34,211,238,0.24)]"
          title="line-of-sight cone"
          style={{
            left: tile.coordinates.x * TILE_SIZE_PX,
            top: tile.coordinates.y * TILE_SIZE_PX,
            width: TILE_SIZE_PX,
            height: TILE_SIZE_PX,
            zIndex: Z_INDEX.CONTENT_OVERLAY_LOW + 2,
          }}
        />
      ))}

      {/* Persistent structured spell zones */}
      {activeZoneTiles.map(({ zone, position, visualFamily }) => {
        const zoneStyle = ZONE_VISUAL_STYLES[visualFamily];
        return (
        <div
          key={`active-zone-${zone.id}-${position.x}-${position.y}`}
          className={`absolute border ${zoneStyle.className}`}
          title={`${zone.spellId} ${zoneStyle.label}`}
          style={{
            left: position.x * TILE_SIZE_PX,
            top: position.y * TILE_SIZE_PX,
            width: TILE_SIZE_PX,
            height: TILE_SIZE_PX,
            transition: 'opacity 180ms ease-out',
          }}
        />
        );
      })}

      {/* Target-bound delayed and movement-triggered spell state */}
      {targetBoundSpellMarkers.map((marker, index) => (
        <div
          key={marker.id}
          className="absolute rounded-md border border-amber-200/70 bg-slate-950/80 px-1 py-0.5 text-[9px] font-bold tracking-wide text-amber-100 shadow-lg"
          title={marker.title}
          style={{
            left: marker.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            top: marker.position.y * TILE_SIZE_PX + TILE_SIZE_PX + 2 + (index % 2) * 12,
            transform: 'translateX(-50%)',
            zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
          }}
        >
          {marker.label}
        </div>
      ))}

      {/* Attack-rider spell markers */}
      {riderSpellMarkers.map((marker) => (
        <div
          key={marker.id}
          className="absolute rounded-md border border-fuchsia-200/70 bg-fuchsia-950/82 px-1 py-0.5 text-[9px] font-black tracking-wide text-fuchsia-100 shadow-lg"
          title={marker.title}
          style={{
            left: marker.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            top: marker.position.y * TILE_SIZE_PX + TILE_SIZE_PX + 18 + (marker.offset % 3) * 12,
            transform: 'translateX(-50%)',
            zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
          }}
        >
          {marker.label}
        </div>
      ))}

      {/* Non-creature summon/control artifacts */}
      {spellArtifactMarkers.map((marker, index) => {
        const centerX = marker.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const centerY = marker.position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const radiusTiles = marker.radiusFeet ? Math.max(0.5, marker.radiusFeet / 5) : 0;

        return (
          <React.Fragment key={marker.id}>
            {radiusTiles > 0 && (
              <div
                className="absolute rounded-full border border-emerald-100/45 bg-emerald-300/10 shadow-[0_0_18px_rgba(16,185,129,0.28)]"
                title={`${marker.title} area`}
                style={{
                  left: centerX - radiusTiles * TILE_SIZE_PX,
                  top: centerY - radiusTiles * TILE_SIZE_PX,
                  width: radiusTiles * TILE_SIZE_PX * 2,
                  height: radiusTiles * TILE_SIZE_PX * 2,
                  zIndex: Z_INDEX.CONTENT_OVERLAY_LOW + 1,
                }}
              />
            )}
            <div
              data-testid={`spell-map-artifact-${marker.family}`}
              className="absolute flex min-h-6 min-w-6 max-w-[3rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-emerald-100/85 bg-emerald-600/92 px-1 text-[9px] font-black leading-none text-white shadow-[0_0_14px_rgba(16,185,129,0.58)]"
              title={marker.title}
              style={{
                left: centerX + (index % 3 - 1) * 18,
                top: centerY + (Math.floor(index / 3) % 2) * 14,
                zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
              }}
            >
              {/* The marker is the readable handle for non-creature spell state:
                  helpers, objects, guardians, and entrances do not have normal
                  creature tokens but still occupy or affect map space. */}
              {marker.label}
            </div>
          </React.Fragment>
        );
      })}

      {/* Active teleport destination assignment */}
      {activeTeleportTarget && teleportDestinationPreview && (
        <div
          className="absolute rounded border border-sky-200/80 bg-sky-950/85 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.55)]"
          title={`${teleportDestinationPreview.ability.name} needs a destination for ${activeTeleportTarget.name}`}
          style={{
            left: activeTeleportTarget.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            top: activeTeleportTarget.position.y * TILE_SIZE_PX - 22,
            transform: 'translateX(-50%)',
            zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
          }}
        >
          {/* Multi-target teleports assign landing spaces one creature at a
              time. This keeps the 2D map explicit about which creature owns
              the current blue destination preview. */}
          DEST: {activeTeleportTarget.name}
        </div>
      )}

      {/* Chosen teleport destinations during multi-target assignment */}
      {assignedTeleportDestinations.map((assignment) => (
        <div
          key={`assigned-teleport-${assignment.targetId}`}
          className="absolute rounded-full border border-sky-100/90 bg-sky-700/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_0_10px_rgba(56,189,248,0.6)]"
          title={`${assignment.abilityName} destination chosen for ${assignment.targetName}`}
          style={{
            left: assignment.destination.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            top: assignment.destination.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            transform: 'translate(-50%, -50%)',
            zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
          }}
        >
          {/* Previously chosen destinations stay visible while assigning later
              targets, so Scatter-style setup does not force the player to
              remember which blue tile was already committed. */}
          SET: {assignment.targetName}
        </div>
      ))}

      {/* Controlled-entity touch-delivery cues */}
      {spellDeliveryVisuals.map((visual) => {
        const fromX = visual.from.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const fromY = visual.from.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const toX = visual.to.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const toY = visual.to.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const deltaX = toX - fromX;
        const deltaY = toY - fromY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);

        return (
          <React.Fragment key={visual.id}>
            <div
              className="absolute"
              title={`${visual.spellName} delivered through touch-delivery actor`}
              style={{
                left: fromX,
                top: fromY,
                width: length,
                borderTop: '3px dotted rgba(34, 211, 238, 0.95)',
                transform: `rotate(${angle}rad)`,
                transformOrigin: '0 50%',
                filter: 'drop-shadow(0 0 7px rgba(34, 211, 238, 0.9))',
                zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
              }}
            />
            <div
              className="absolute rounded-full border border-cyan-100/90 bg-cyan-700/82 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_0_10px_rgba(34,211,238,0.62)]"
              style={{
                left: fromX,
                top: fromY - 16,
                transform: 'translateX(-50%)',
                zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
              }}
            >
              {/* This is a delivery-origin cue, not movement. It tells the
                  player that the spell traveled through the permissioned
                  delivery actor's space. */}
              {visual.label}
            </div>
          </React.Fragment>
        );
      })}

      {/* Resolved structured spell movement cues */}
      {spellMovementVisuals.map((visual) => {
        // Draw the actual resolved movement path when one is available. Teleports
        // still use a start/end jump, while forced movement can now show routed
        // turns around blocked terrain.
        const isTeleport = visual.type === 'teleport';
        const visualPath = visual.path && visual.path.length > 1 ? visual.path : [visual.from, visual.to];
        const segments = visualPath.slice(1).map((point, index) => {
          const previous = visualPath[index];
          const fromX = previous.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
          const fromY = previous.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
          const toX = point.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
          const toY = point.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
          const deltaX = toX - fromX;
          const deltaY = toY - fromY;
          return {
            key: `${visual.id}-segment-${index}`,
            fromX,
            fromY,
            length: Math.sqrt(deltaX * deltaX + deltaY * deltaY),
            angle: Math.atan2(deltaY, deltaX)
          };
        });

        return (
          <React.Fragment key={visual.id}>
            {segments.map(segment => (
              <div
                key={segment.key}
                className="absolute"
                title={`${visual.spellId} ${isTeleport ? 'teleport destination' : 'forced movement path'}`}
                style={{
                  left: segment.fromX,
                  top: segment.fromY,
                  width: segment.length,
                  borderTop: isTeleport ? '3px dashed rgba(96, 165, 250, 0.9)' : '3px solid rgba(251, 191, 36, 0.9)',
                  transform: `rotate(${segment.angle}rad)`,
                  transformOrigin: '0 50%',
                  filter: isTeleport ? 'drop-shadow(0 0 6px rgba(96, 165, 250, 0.8))' : 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.8))',
                  zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
                }}
              />
            ))}
            <div
              className="absolute rounded-full border-2 px-1 text-[8px] font-black tracking-wide"
              style={{
                left: visual.to.x * TILE_SIZE_PX + 4,
                top: visual.to.y * TILE_SIZE_PX + 4,
                borderColor: isTeleport ? 'rgba(147, 197, 253, 0.95)' : 'rgba(253, 230, 138, 0.95)',
                background: isTeleport ? 'rgba(30, 64, 175, 0.72)' : 'rgba(120, 53, 15, 0.72)',
                color: '#fff7ed',
                zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
              }}
            >
              {isTeleport ? 'BLINK' : 'PUSH'}
            </div>
          </React.Fragment>
        );
      })}

      {/* Status icons on top of each character token */}
      {characters.map((character) => (
        <div
          key={`status-${character.id}`}
          className="absolute flex gap-1 items-center justify-center"
          style={{
            left: character.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            top: character.position.y * TILE_SIZE_PX - 6,
            transform: 'translate(-50%, -100%)',
            transition: 'opacity 200ms ease-out',
            opacity: character.statusEffects.length ? 1 : 0,
            zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
          }}
        >
          {character.statusEffects.map((effect) => (
            <span
              key={`${character.id}-${effect.id}`}
              className="text-xs font-semibold px-1 py-0.5 rounded-full bg-gray-900/80 border border-white/10"
              title={`${effect.name} (${effect.duration}r)`}
              style={{
                color: effect.type === 'buff' ? '#a7f3d0' : effect.type === 'debuff' ? '#fca5a5' : '#e5e7eb',
                transition: 'transform 150ms ease-out, opacity 150ms ease-out',
              }}
            >
              {getOverlayStatusEffectIcon(effect)}
            </span>
          ))}
        </div>
      ))}

      {/* Spell effect ripples */}
      {spellAnimations.map((anim) => {
        const data = anim.data as SpellEffectOverlayData | undefined;
        // Legacy payloads may include a single targetPosition instead of an array.
        const positions = data?.targetPositions || (data?.targetPosition ? [data.targetPosition] : []);
        return positions.map((pos) => (
          <div
            key={`${anim.id}-${pos.x}-${pos.y}`}
            className="absolute rounded-full bg-indigo-400/40 border border-indigo-300/40"
            style={{
              left: pos.x * TILE_SIZE_PX,
              top: pos.y * TILE_SIZE_PX,
              width: TILE_SIZE_PX,
              height: TILE_SIZE_PX,
              transform: activeSpells[anim.id] ? 'scale(1.05)' : 'scale(0.8)',
              opacity: activeSpells[anim.id] ? 0.85 : 0,
              transition: `opacity ${anim.duration}ms ease-out, transform ${anim.duration}ms ease-out`,
            }}
          />
        ));
      })}

      {/* AoE preview outline to complement per-tile tinting */}
      {aoePreview?.affectedTiles.map((pos) => (
        <div
          key={`aoe-${pos.x}-${pos.y}`}
          className="absolute border-2 border-red-300/70 bg-red-400/10"
          style={{
            left: pos.x * TILE_SIZE_PX,
            top: pos.y * TILE_SIZE_PX,
            width: TILE_SIZE_PX,
            height: TILE_SIZE_PX,
            transition: 'opacity 120ms ease-out',
          }}
        />
      ))}
    </div>
  );
};

export default BattleMapOverlay;
