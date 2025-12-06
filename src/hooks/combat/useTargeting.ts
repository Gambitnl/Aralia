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
import { resolveAoEParams } from '../../utils/targetingUtils';
import { calculateAffectedTiles } from '../../utils/aoeCalculations';

interface UseTargetingProps {
    mapData: BattleMapData | null;
    characters: CombatCharacter[]; // Needed for validation logic if we add it here later
}

export const useTargeting = ({ mapData }: UseTargetingProps) => {
    const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null);
    const [targetingMode, setTargetingMode] = useState<boolean>(false);

    // Stores the current AoE preview data for rendering highlights on the map
    const [aoePreview, setAoePreview] = useState<{
        center: Position;
        affectedTiles: Position[];
        ability: Ability;
    } | null>(null);

    /**
     * Enters targeting mode for a specific ability.
     * If the ability is 'self', it effectively skips selection (handled by consumer usually, 
     * but state is updated here for consistency).
     */
    const startTargeting = useCallback((ability: Ability) => {
        setSelectedAbility(ability);
        setTargetingMode(true);
    }, []);

    /**
     * Cancels the current targeting session, clearing selection and previews.
     */
    const cancelTargeting = useCallback(() => {
        setSelectedAbility(null);
        setTargetingMode(false);
        setAoePreview(null);
    }, []);

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
        startTargeting,
        cancelTargeting,
        previewAoE,
        // Expose setters if external control is needed, but prefer actions above
        setSelectedAbility,
        setTargetingMode
    };
};
