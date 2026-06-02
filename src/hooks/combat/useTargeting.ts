// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 10:16:10
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file hooks/combat/useTargeting.ts
 * Manages the "Selection Phase" of ability usage.
 * Handles state for:
 * - Currently selected ability
 * - Targeting mode (active/inactive)
 * - AoE Previews (calculating affected tiles for hover visuals)
 * 
 * Logic decoupled from execution to allow cleaner UI testing.
 */

import { useState, useCallback } from 'react';
import { Ability, Position, CombatCharacter, BattleMapData } from '../../types/combat';
import { resolveAoEParams } from '../../utils/spatial/targetingUtils';
import { calculateAffectedTiles } from '../../utils/combat/aoeCalculations';
import { getDistance } from '../../utils/combatUtils';
import { hasLineOfSight } from '../../utils/lineOfSight';

interface UseTargetingProps {
    mapData: BattleMapData | null;
    characters: CombatCharacter[]; // Needed for validation logic if we add it here later
}

interface TeleportDestinationPreview {
    origin: Position;
    targetId: string;
    affectedTiles: Position[];
    ability: Ability;
}

const parseFeetToTiles = (value: unknown): number => {
    if (typeof value === 'number') return Math.max(0, Math.floor(value / 5));
    if (typeof value === 'string') {
        const match = value.match(/(\d+)/);
        return match ? Math.max(0, Math.floor(parseInt(match[1], 10) / 5)) : 0;
    }
    return 0;
};

const getTeleportRangeInTiles = (ability: Ability): number => {
    const abilityRanges = ability.effects
        .filter(effect => effect.type === 'teleport')
        .map(effect => effect.value ?? 0);

    const spellRanges = (ability.spell?.effects ?? [])
        .filter((effect: any) => effect.type === 'MOVEMENT' && effect.movementType === 'teleport')
        .map((effect: any) => Math.max(
            parseFeetToTiles(effect.distance),
            parseFeetToTiles(effect.forcedMovement?.maxDistance)
        ));

    return Math.max(0, ...abilityRanges, ...spellRanges);
};

const hasTeleportMovement = (ability: Ability): boolean => (
    ability.effects.some(effect => effect.type === 'teleport') ||
    (ability.spell?.effects ?? []).some((effect: any) => effect.type === 'MOVEMENT' && effect.movementType === 'teleport')
);

export const useTargeting = ({ mapData, characters }: UseTargetingProps) => {
    const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null);
    const [targetingMode, setTargetingMode] = useState<boolean>(false);

    // Stores the current AoE preview data for rendering highlights on the map
    const [aoePreview, setAoePreview] = useState<{
        center: Position;
        affectedTiles: Position[];
        ability: Ability;
    } | null>(null);

    const [teleportDestinationPreview, setTeleportDestinationPreview] = useState<TeleportDestinationPreview | null>(null);

    /**
     * Enters targeting mode for a specific ability.
     * If the ability is 'self', it effectively skips selection (handled by consumer usually, 
     * but state is updated here for consistency).
     */
    const startTargeting = useCallback((ability: Ability) => {
        setSelectedAbility(ability);
        setTargetingMode(true);
        setTeleportDestinationPreview(null);
    }, []);

    /**
     * Cancels the current targeting session, clearing selection and previews.
     */
    const cancelTargeting = useCallback(() => {
        setSelectedAbility(null);
        setTargetingMode(false);
        setAoePreview(null);
        setTeleportDestinationPreview(null);
    }, []);

    const previewTeleportDestinations = useCallback((
        ability: Ability,
        caster: CombatCharacter,
        movedTarget: CombatCharacter = caster
    ) => {
        if (!mapData || !hasTeleportMovement(ability)) {
            setTeleportDestinationPreview(null);
            return;
        }

        const range = getTeleportRangeInTiles(ability);
        if (range <= 0) {
            setTeleportDestinationPreview(null);
            return;
        }

        const casterTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
        const requiresLineOfSight = ability.spell?.targeting?.lineOfSight ?? true;

        // Teleport destinations are different from cast targets: a self spell
        // like Misty Step targets the caster, but the player still needs to pick
        // an empty destination tile. These candidates intentionally come from
        // map occupancy, movement blocking, range, and line-of-sight evidence so
        // the preview does not lie about where the movement command can land.
        const affectedTiles = Array.from(mapData.tiles.values())
            .filter(tile => getDistance(movedTarget.position, tile.coordinates) <= range)
            .filter(tile => !tile.blocksMovement)
            .filter(tile => !characters.some(character =>
                character.id !== movedTarget.id &&
                character.position.x === tile.coordinates.x &&
                character.position.y === tile.coordinates.y
            ))
            .filter(tile => {
                if (!requiresLineOfSight || !casterTile) return true;
                return hasLineOfSight(casterTile, tile, mapData);
            })
            .map(tile => tile.coordinates);

        setTeleportDestinationPreview({
            origin: movedTarget.position,
            targetId: movedTarget.id,
            affectedTiles,
            ability
        });
    }, [characters, mapData]);

    const isTeleportDestination = useCallback((position: Position): boolean => {
        return teleportDestinationPreview?.affectedTiles.some(tile =>
            tile.x === position.x && tile.y === position.y
        ) ?? false;
    }, [teleportDestinationPreview]);

    /**
     * Calculates and updates the AoE preview based on the current mouse/hover position.
     * Utilizes pure utility functions for the math.
     * 
     * @param position - The grid coordinates of the tile being hovered.
     * @param caster - The character using the ability (needed for origin-based shapes like Cones).
     */
    const previewAoE = useCallback((position: Position, caster: CombatCharacter) => {
        // Exit if no ability selected or ability has no AoE
        if (!selectedAbility?.areaOfEffect) {
            setAoePreview(null);
            return;
        }

        // Resolve the geometric parameters (origin, direction, etc.)
        const aoeParams = resolveAoEParams(
            selectedAbility.areaOfEffect,
            position,
            caster
        );

        if (!aoeParams) return;

        // Calculate actual grid tiles affected
        const affectedTiles = calculateAffectedTiles(aoeParams);

        setAoePreview({
            center: position,
            affectedTiles,
            ability: selectedAbility
        });
    }, [selectedAbility]);

    return {
        selectedAbility,
        targetingMode,
        aoePreview,
        teleportDestinationPreview,
        startTargeting,
        cancelTargeting,
        previewAoE,
        previewTeleportDestinations,
        isTeleportDestination,
        // Expose setters if external control is needed, but prefer actions above
        setSelectedAbility,
        setTargetingMode
    };
};
