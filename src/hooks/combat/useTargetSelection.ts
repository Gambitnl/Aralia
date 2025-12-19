import { useMemo } from 'react';
import { BattleMapData, CombatCharacter } from '../../types/combat';
import { useAbilitySystem } from '../useAbilitySystem';

interface UseTargetSelectionProps {
    abilitySystem: ReturnType<typeof useAbilitySystem>;
    currentCharacter?: CombatCharacter;
    mapData: BattleMapData | null;
    characters: CombatCharacter[];
}

export function useTargetSelection({
    abilitySystem,
    currentCharacter,
    mapData,
    characters
}: UseTargetSelectionProps) {
    // 1. AoE Set: Validates if a tile is in the AoE preview
    const aoeSet = useMemo(() => {
        const set = new Set<string>();
        if (abilitySystem?.aoePreview?.affectedTiles) {
            abilitySystem.aoePreview.affectedTiles.forEach((p: { x: number; y: number }) => {
                set.add(`${p.x}-${p.y}`);
            });
        }
        return set;
    }, [abilitySystem?.aoePreview]);

    // 2. Valid Target Set: Validates if a tile is a valid target for the selected ability
    // This is the most expensive check (LoS), so memoization here is critical.
    const validTargetSet = useMemo(() => {
        const set = new Set<string>();
        if (abilitySystem?.targetingMode && abilitySystem?.selectedAbility && currentCharacter && mapData) {
            // Optimization: Only check tiles within range of caster
            const range = abilitySystem.selectedAbility.range;
            const casterX = currentCharacter.position.x;
            const casterY = currentCharacter.position.y;

            // Bounding box for range
            const minX = Math.max(0, casterX - range);
            const maxX = Math.min(mapData.dimensions.width - 1, casterX + range);
            const minY = Math.max(0, casterY - range);
            const maxY = Math.min(mapData.dimensions.height - 1, casterY + range);

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    if (abilitySystem.isValidTarget(abilitySystem.selectedAbility, currentCharacter, { x, y })) {
                        set.add(`${x}-${y}`);
                    }
                }
            }
        }
        return set;
    }, [
        abilitySystem?.targetingMode,
        abilitySystem?.selectedAbility,
        currentCharacter,
        mapData,
        characters // Re-calc if any character moves (blocking)
    ]);

    return {
        aoeSet,
        validTargetSet
    };
}
