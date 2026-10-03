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
import React from 'react';
import type { Ability, Animation, BattleMapData, CombatCharacter, DamageNumber, LightSource, Position, SpellDeliveryVisual, SpellMovementVisual } from '../../types/combat';
import { type SpellMapArtifacts } from './spellMapArtifacts';
import { type ActiveSpellZone, type MovementTriggerDebuff, type ScheduledSpellEffect } from '../../systems/spells/effects/triggerHandler';
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
    aoePreview?: {
        center: {
            x: number;
            y: number;
        };
        affectedTiles: {
            x: number;
            y: number;
        }[];
        ability: Ability;
    } | null;
    /** Active teleport destination-pick state; labels which creature the blue destination tiles belong to. */
    teleportDestinationPreview?: {
        targetId: string;
        affectedTiles: {
            x: number;
            y: number;
        }[];
        ability: Ability;
    } | null;
    /** Destinations already chosen during a multi-target teleport assignment. */
    assignedTeleportDestinations?: Array<{
        targetId: string;
        targetName: string;
        destination: Position;
        abilityName: string;
    }>;
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
declare const BattleMapOverlay: React.FC<BattleMapOverlayProps>;
export default BattleMapOverlay;
