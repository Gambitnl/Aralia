// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 10:16:10
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useMemo } from 'react';
import { BattleMapData, CombatCharacter, Ability } from '../../types/combat';
import { isAtLongRange, maxAttackRangeTiles } from '../../utils/combat/weaponRange';
import { getCombatDistanceFeet, getCombatantToPositionDistanceFeet } from '../../utils/spatial/elevationGeometry';
import { getOccupiedTiles } from '../../utils/combat';

/**
 * GG-495: the subset of valid target tiles where a ranged or thrown attack
 * would roll with Disadvantage (past normal range, within long range).
 *
 * It uses the same distance measures as the rules: creature to creature when
 * a creature stands on the tile (the attack roll in AbilityCommandFactory),
 * creature to tile otherwise (useTargetValidator). The overlay therefore never
 * shades a tile differently from how the attack resolves. Abilities without a
 * long range return an empty set.
 */
export function computeLongRangeTargetSet(
    ability: Ability,
    caster: CombatCharacter,
    validTargetSet: ReadonlySet<string>,
    characters: readonly CombatCharacter[],
    mapData: BattleMapData,
): Set<string> {
    const band = new Set<string>();
    if (ability.longRange === undefined) return band;

    // Map each occupied tile to the creature on it, so a token's tile uses the
    // same footprint-aware distance the attack roll uses.
    const occupantByTile = new Map<string, CombatCharacter>();
    for (const character of characters) {
        if (character.id === caster.id) continue;
        for (const position of getOccupiedTiles(character)) {
            occupantByTile.set(`${position.x}-${position.y}`, character);
        }
    }

    for (const tileId of validTargetSet) {
        const [x, y] = tileId.split('-').map(Number);
        const occupant = occupantByTile.get(tileId);
        const distanceFeet = occupant
            ? getCombatDistanceFeet(caster, occupant, mapData)
            : getCombatantToPositionDistanceFeet(caster, { x, y }, mapData);
        if (isAtLongRange(ability, distanceFeet / 5)) band.add(tileId);
    }
    return band;
}

interface UseTargetSelectionProps {
    selectedAbility: Ability | null;
    targetingMode: boolean;
    isValidTarget: (ability: Ability, caster: CombatCharacter, position: { x: number; y: number }) => boolean;
    aoePreview?: { affectedTiles: { x: number; y: number }[] } | null;
    teleportDestinationPreview?: { affectedTiles: { x: number; y: number }[] } | null;
    currentCharacter?: CombatCharacter;
    mapData: BattleMapData | null;
    characters: CombatCharacter[];
}

export function useTargetSelection({
    selectedAbility,
    targetingMode,
    isValidTarget,
    aoePreview,
    teleportDestinationPreview,
    currentCharacter,
    mapData,
    characters
}: UseTargetSelectionProps) {
    // 1. AoE Set: Validates if a tile is in the AoE preview
    const aoeSet = useMemo(() => {
        const set = new Set<string>();
        if (aoePreview?.affectedTiles) {
            aoePreview.affectedTiles.forEach((p: { x: number; y: number }) => {
                set.add(`${p.x}-${p.y}`);
            });
        }
        return set;
    }, [aoePreview]);

    // 2. Teleport Destination Set: these tiles are movement destinations, not
    // ordinary spell targets. Keeping them separate prevents self-teleports from
    // being drawn as attackable tiles and gives both map renderers a truthful
    // preview vocabulary for "you may blink here."
    const teleportDestinationSet = useMemo(() => {
        const set = new Set<string>();
        if (targetingMode && teleportDestinationPreview?.affectedTiles) {
            teleportDestinationPreview.affectedTiles.forEach((p: { x: number; y: number }) => {
                set.add(`${p.x}-${p.y}`);
            });
        }
        return set;
    }, [targetingMode, teleportDestinationPreview]);

    // 3. Valid Target Set: Validates if a tile is a valid target for the selected ability
    // This is the most expensive check (LoS), so memoization here is critical.
    const validTargetSet = useMemo(() => {
        const set = new Set<string>();
        if (targetingMode && selectedAbility && currentCharacter && mapData) {
            // Optimization: Only check tiles within range of caster. GG-495: a
            // ranged or thrown attack reaches its long range (with Disadvantage),
            // so the box uses the long range when the ability has one.
            const range = maxAttackRangeTiles(selectedAbility);
            const casterX = currentCharacter.position.x;
            const casterY = currentCharacter.position.y;

            // Bounding box for range
            const minX = Math.max(0, casterX - range);
            const maxX = Math.min(mapData.dimensions.width - 1, casterX + range);
            const minY = Math.max(0, casterY - range);
            const maxY = Math.min(mapData.dimensions.height - 1, casterY + range);

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    if (isValidTarget(selectedAbility, currentCharacter, { x, y })) {
                        set.add(`${x}-${y}`);
                    }
                }
            }
        }
        return set;
    }, [
        targetingMode,
        selectedAbility,
        currentCharacter,
        mapData,
        isValidTarget,
        characters
    ]);

    // 4. Long-range band (GG-495): valid tiles where the attack has Disadvantage.
    const longRangeTargetSet = useMemo(() => (
        selectedAbility && currentCharacter && mapData
            ? computeLongRangeTargetSet(selectedAbility, currentCharacter, validTargetSet, characters, mapData)
            : new Set<string>()
    ), [selectedAbility, currentCharacter, validTargetSet, characters, mapData]);

    return {
        aoeSet,
        validTargetSet,
        longRangeTargetSet,
        teleportDestinationSet
    };
}
