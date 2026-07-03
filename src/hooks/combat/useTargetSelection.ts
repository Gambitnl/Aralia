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
            // Optimization: Only check tiles within range of caster
            const range = selectedAbility.range;
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

    return {
        aoeSet,
        validTargetSet,
        teleportDestinationSet
    };
}
