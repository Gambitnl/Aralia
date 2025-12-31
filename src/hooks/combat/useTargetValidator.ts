/**
 * @file hooks/combat/useTargetValidator.ts
 * Manages validation logic for targeting abilities.
 * Decoupled from the main AbilitySystem to provide stable references and reduce re-renders.
 */
import { useCallback, useMemo, useRef } from 'react';
import { CombatCharacter, Ability, Position, BattleMapData } from '../../types/combat';
import { getDistance } from '../../utils/combatUtils';
import { hasLineOfSight } from '../../utils/lineOfSight';

interface UseTargetValidatorProps {
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
}

export function useTargetValidator({ characters, mapData }: UseTargetValidatorProps) {

    // [Steward] Optimization: Use Ref to hold latest characters without triggering re-creation of callbacks.
    // We update this ref on every render so it's available for callbacks immediately.
    const charactersRef = useRef(characters);
    charactersRef.current = characters;

    // [Steward] Create a topology hash that only changes when character positions/teams change.
    // This allows us to stabilize isValidTarget against irrelevant updates like HP changes.
    const characterTopology = useMemo(() => {
        return characters.map(c => `${c.id}:${c.position.x},${c.position.y}:${c.team}`).join('|');
    }, [characters]);

    // Helper: Find character at exact grid position
    // ACTION: Updated dependency to characterTopology
    const getCharacterAtPosition = useCallback((position: Position): CombatCharacter | null => {
        return charactersRef.current.find(char =>
            char.position.x === position.x && char.position.y === position.y
        ) || null;
    }, [characterTopology]);

    /**
     * Validates if a target position is legal for the given ability.
     * ACTION: Updated dependency to characterTopology
     */
    const isValidTarget = useCallback((
        ability: Ability,
        caster: CombatCharacter,
        targetPosition: Position
    ): boolean => {
        if (!mapData) return false;

        // 1. Tile Existence Check
        const startTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
        const endTile = mapData.tiles.get(`${targetPosition.x}-${targetPosition.y}`);
        if (!startTile || !endTile) return false;

        // 2. Range Check
        const distance = getDistance(caster.position, targetPosition);
        if (distance > ability.range) return false;

        // 3. Line of Sight Check
        if (ability.type === 'attack' || ability.type === 'spell') {
            if (!hasLineOfSight(startTile, endTile, mapData)) {
                return false;
            }
        }

        const targetCharacter = getCharacterAtPosition(targetPosition);

        // 4. Logic by Targeting Type
        switch (ability.targeting) {
            case 'single_enemy':
                return !!targetCharacter && targetCharacter.team !== caster.team;
            case 'single_ally':
                return !!targetCharacter && targetCharacter.team === caster.team && targetCharacter.id !== caster.id;
            case 'single_any':
                return !!targetCharacter;
            case 'self':
                return targetPosition.x === caster.position.x && targetPosition.y === caster.position.y;
            case 'area':
                return true;
            default:
                return false;
        }
    }, [mapData, getCharacterAtPosition]);

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
        getValidTargets,
        getCharacterAtPosition
    };
}
