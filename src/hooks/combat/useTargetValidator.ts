// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 02:23:08
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file hooks/combat/useTargetValidator.ts
 * Manages validation logic for targeting abilities.
 * Decoupled from the main AbilitySystem to provide stable references and reduce re-renders.
 */
import { useCallback } from 'react';
import { CombatCharacter, Ability, Position, BattleMapData } from '../../types/combat';
import { getDistance } from '../../utils/combatUtils';
import { hasLineOfSight } from '../../utils/lineOfSight';

interface UseTargetValidatorProps {
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
}

// The UI still needs a simple yes/no answer for target highlights, but manual
// combat also needs this richer result so invalid clicks can explain themselves.
export interface TargetValidationResult {
    isValid: boolean;
    reason?: string;
}

// Ranges in combat abilities are tile counts. Showing the 5-foot equivalent
// keeps the grid UI aligned with D&D combat language without changing storage.
const formatTileDistance = (distance: number): string => {
    const tileLabel = distance === 1 ? 'tile' : 'tiles';
    const feet = distance * 5;
    return `${distance} ${tileLabel} (${feet} ft)`;
};

// Prefer the creature name when the player clicked a token; fall back to a
// generic label for empty-ground clicks and malformed map state.
const getTargetLabel = (targetCharacter: CombatCharacter | null): string => {
    return targetCharacter?.name ?? 'That target';
};

export function useTargetValidator({ characters, mapData }: UseTargetValidatorProps) {

    // Helper: Find character at exact grid position
    const getCharacterAtPosition = useCallback((position: Position): CombatCharacter | null => {
        return characters.find(char =>
            char.position.x === position.x && char.position.y === position.y
        ) || null;
    }, [characters]);

    /**
     * Validates a target position and keeps the reason when it fails.
     * This preserves the old yes/no target checks while giving manual combat
     * enough information to explain why a clicked enemy cannot be attacked.
     */
    const getTargetValidation = useCallback((
        ability: Ability,
        caster: CombatCharacter,
        targetPosition: Position
    ): TargetValidationResult => {
        if (!mapData) {
            return {
                isValid: false,
                reason: 'The battle map is not ready yet.'
            };
        }

        // 1. Tile Existence Check
        const startTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
        const endTile = mapData.tiles.get(`${targetPosition.x}-${targetPosition.y}`);
        if (!startTile || !endTile) {
            return {
                isValid: false,
                reason: 'That target is not on the battle map.'
            };
        }

        const targetCharacter = getCharacterAtPosition(targetPosition);

        // 2. Range Check
        const distance = getDistance(caster.position, targetPosition);
        if (distance > ability.range) {
            const targetLabel = getTargetLabel(targetCharacter);
            return {
                isValid: false,
                reason: `${targetLabel} is too far away for ${ability.name}. Range: ${formatTileDistance(ability.range)}; distance: ${formatTileDistance(distance)}.`
            };
        }

        // 3. Line of Sight Check
        if (ability.type === 'attack' || ability.type === 'spell') {
            if (!hasLineOfSight(startTile, endTile, mapData)) {
                const targetLabel = getTargetLabel(targetCharacter).toLowerCase();
                return {
                    isValid: false,
                    reason: `No clear line of sight to ${targetLabel} for ${ability.name}.`
                };
            }
        }

        // 4. Logic by Targeting Type
        switch (ability.targeting) {
            case 'single_enemy':
                if (!targetCharacter) {
                    return {
                        isValid: false,
                        reason: `${ability.name} needs an enemy target.`
                    };
                }
                if (targetCharacter.team === caster.team) {
                    return {
                        isValid: false,
                        reason: `${ability.name} can only target enemies.`
                    };
                }
                return { isValid: true };
            case 'single_ally':
                if (!targetCharacter) {
                    return {
                        isValid: false,
                        reason: `${ability.name} needs an ally target.`
                    };
                }
                if (targetCharacter.team !== caster.team || targetCharacter.id === caster.id) {
                    return {
                        isValid: false,
                        reason: `${ability.name} can only target an ally other than ${caster.name}.`
                    };
                }
                return { isValid: true };
            case 'single_any':
                if (!targetCharacter) {
                    return {
                        isValid: false,
                        reason: `${ability.name} needs a creature target.`
                    };
                }
                return { isValid: true };
            case 'self':
                if (targetPosition.x !== caster.position.x || targetPosition.y !== caster.position.y) {
                    return {
                        isValid: false,
                        reason: `${ability.name} can only target ${caster.name}.`
                    };
                }
                return { isValid: true };
            case 'area':
                return { isValid: true };
            default:
                return {
                    isValid: false,
                    reason: `${ability.name} does not have a supported targeting rule yet.`
                };
        }
    }, [mapData, getCharacterAtPosition]);

    /**
     * Maintains the original boolean API for highlight calculations and older callers.
     * Detailed failure messages are available through getTargetValidation above.
     */
    const isValidTarget = useCallback((
        ability: Ability,
        caster: CombatCharacter,
        targetPosition: Position
    ): boolean => {
        return getTargetValidation(ability, caster, targetPosition).isValid;
    }, [getTargetValidation]);

    /**
     * Generates a list of all valid target positions on the map.
     */
    const getValidTargets = useCallback((
        ability: Ability,
        caster: CombatCharacter
    ): Position[] => {
        if (!mapData) return [];
        const validPositions: Position[] = [];

        for (let x = 0; x < mapData.dimensions.width; x++) {
            for (let y = 0; y < mapData.dimensions.height; y++) {
                const position = { x, y };
                if (isValidTarget(ability, caster, position)) {
                    validPositions.push(position);
                }
            }
        }
        return validPositions;
    }, [mapData, isValidTarget]);

    return {
        isValidTarget,
        getTargetValidation,
        getValidTargets,
        getCharacterAtPosition
    };
}
