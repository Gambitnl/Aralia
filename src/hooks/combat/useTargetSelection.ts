import { useMemo } from 'react';
import { BattleMapData, CombatCharacter, Ability } from '../../types/combat';

interface UseTargetSelectionProps {
    selectedAbility: Ability | null;
    targetingMode: boolean;
    isValidTarget: (ability: Ability, caster: CombatCharacter, position: { x: number; y: number }) => boolean;
    aoePreview?: { affectedTiles: { x: number; y: number }[] } | null;
    currentCharacter?: CombatCharacter;
    mapData: BattleMapData | null;
    characters: CombatCharacter[];
}

export function useTargetSelection({
    selectedAbility,
    targetingMode,
    isValidTarget,
    aoePreview,
    currentCharacter,
    mapData,
    characters: _characters
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

    // 2. Valid Target Set: Validates if a tile is a valid target for the selected ability
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
    // TODO(lint-intent): If target validation depends on other actors, ensure isValidTarget is memoized against them.
    }, [
        targetingMode,
        selectedAbility,
        currentCharacter,
        mapData,
        isValidTarget // Now a stable dependency from useTargetValidator        
    ]);

    return {
        aoeSet,
        validTargetSet
    };
}
