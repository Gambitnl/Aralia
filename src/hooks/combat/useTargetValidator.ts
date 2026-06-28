// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/06/2026, 20:16:29
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 6 files
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
import { CombatCharacter, Ability, Position, BattleMapData, CombatState, AbilityCost } from '../../types/combat';
import type { SpellTargeting } from '../../types/spells';
import { getDistance, getCharacterDistance, getOccupiedTiles } from '../../utils/combatUtils';
import { canAffordActionCost } from '../../utils/combat/actionEconomyUtils';
import { hasLineOfSight } from '../../utils/lineOfSight';
import { CreatureTaxonomy } from '../../systems/creatures/CreatureTaxonomy';
import { TargetResolver } from '../../systems/spells/targeting/TargetResolver';

interface UseTargetValidatorProps {
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
}

type TouchDeliveryCost =
    NonNullable<NonNullable<CombatCharacter['summonMetadata']>['actionPermissions']>['touchDeliveryCost'];

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

// Spell-created abilities can carry the original structured spell data. When
// it is present, prefer the shared spell resolver for legality messages so the
// battle-map UI, runtime spell resolver, and AI can speak the same rejection
// language instead of each rephrasing restricted-target failures.
const getStructuredSpellTargeting = (ability: Ability): SpellTargeting | null => {
    const spellTargeting = ability.spell?.targeting;
    return spellTargeting && typeof spellTargeting === 'object'
        ? spellTargeting as SpellTargeting
        : null;
};

const isTouchSpell = (ability: Ability): boolean => {
    return ability.type === 'spell' &&
        ability.spell?.range?.type?.toLowerCase?.() === 'touch';
};

const isTouchDeliveryActorForCaster = (character: CombatCharacter, caster: CombatCharacter): boolean => {
    const permissions = character.summonMetadata?.actionPermissions;

    // Touch delivery is now a shared controlled-entity permission, not a
    // fallback based on a familiar-looking actor name. Requiring the explicit
    // permission keeps summoned actors from inheriting touch delivery unless
    // their spell data opted into that action surface.
    if (permissions?.canDeliverTouchSpells !== true) {
        return false;
    }

    // Once a summon is owned by the caster and has opted into touch delivery,
    // its display identity is no longer the authority. Find Familiar is the
    // current live spell that uses this, but future controlled actors can share
    // the same bridge by declaring permission and cost metadata.
    return !!character.isSummon &&
        character.summonMetadata?.casterId === caster.id;
};

export const getTouchDeliveryActionCost = (
    touchDeliveryCost: TouchDeliveryCost = 'reaction'
): AbilityCost | null => {
    // Summon metadata stores player-facing cost labels, while the shared combat
    // economy uses the internal button-cost terms. Keep the translation in one
    // place so target validation and execution spend the same resource.
    switch (touchDeliveryCost) {
        case 'action':
            return { type: 'action' };
        case 'bonus_action':
            return { type: 'bonus' };
        case 'reaction':
            return { type: 'reaction' };
        case 'free':
            return { type: 'free' };
        case 'none':
            return null;
        default:
            return { type: 'reaction' };
    }
};

export const findTouchDeliveryActor = (
    ability: Ability,
    caster: CombatCharacter,
    targetCharacter: CombatCharacter | null,
    characters: CombatCharacter[]
): { deliveryActor: CombatCharacter; casterDistance: number; targetDistance: number } | null => {
    if (!targetCharacter || !isTouchSpell(ability)) {
        return null;
    }

    const familiar = characters.find(candidate => {
        if (!isTouchDeliveryActorForCaster(candidate, caster)) {
            return false;
        }

        const casterDistanceFeet = getCharacterDistance(caster, candidate) * 5;
        const deliveryRangeFeet = candidate.summonMetadata?.actionPermissions?.touchDeliveryRangeFeet ?? 100;
        const targetDistanceTiles = getCharacterDistance(candidate, targetCharacter);
        const touchDeliveryCost = candidate.summonMetadata?.actionPermissions?.touchDeliveryCost ?? 'reaction';
        const deliveryActionCost = getTouchDeliveryActionCost(touchDeliveryCost);
        const deliveryCostAvailable = !deliveryActionCost ||
            canAffordActionCost(candidate, deliveryActionCost);

        return casterDistanceFeet <= deliveryRangeFeet && targetDistanceTiles <= 1 && deliveryCostAvailable;
    });

    if (!familiar) {
        return null;
    }

    return {
        deliveryActor: familiar,
        casterDistance: getCharacterDistance(caster, familiar),
        targetDistance: getCharacterDistance(familiar, targetCharacter)
    };
};

export function useTargetValidator({ characters, mapData }: UseTargetValidatorProps) {

    // Helper: Find character occupying a specific grid position
    const getCharacterAtPosition = useCallback((position: Position): CombatCharacter | null => {
        return characters.find(char => {
            const occupied = getOccupiedTiles(char);
            return occupied.some(tile => tile.x === position.x && tile.y === position.y);
        }) || null;
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
        // If we targeted a character, use character-to-character distance (closest tiles).
        // Otherwise use position-to-position distance.
        const distance = targetCharacter 
            ? getCharacterDistance(caster, targetCharacter)
            : getDistance(caster.position, targetPosition);

        // Touch spells can originate from a permissioned controlled actor when
        // the caster is personally out of reach. Keep the local name shared so
        // this path does not drift back into Find Familiar-only assumptions.
        const touchDelivery = findTouchDeliveryActor(ability, caster, targetCharacter, characters);

        if (distance > ability.range && !touchDelivery) {
            const targetLabel = getTargetLabel(targetCharacter);
            return {
                isValid: false,
                reason: `${targetLabel} is too far away for ${ability.name}. Range: ${formatTileDistance(ability.range)}; distance: ${formatTileDistance(distance)}.`
            };
        }

        // 3. Line of Sight Check
        if (ability.type === 'attack' || ability.type === 'spell') {
            // Touch delivery is a shared controlled-entity path now. Use the
            // permissioned delivery actor as the line-of-sight origin instead
            // of the old familiar-only return field.
            const lineOfSightSource = touchDelivery?.deliveryActor ?? caster;
            const casterTiles = getOccupiedTiles(lineOfSightSource);
            const targetTiles = targetCharacter 
                ? getOccupiedTiles(targetCharacter)
                : [targetPosition];

            const hasLoS = casterTiles.some(cPos => {
                const cTile = mapData.tiles.get(`${cPos.x}-${cPos.y}`);
                if (!cTile) return false;

                return targetTiles.some(tPos => {
                    const tTile = mapData.tiles.get(`${tPos.x}-${tPos.y}`);
                    if (!tTile) return false;
                    return hasLineOfSight(cTile, tTile, mapData);
                });
            });

            if (!hasLoS) {
                const targetLabel = getTargetLabel(targetCharacter).toLowerCase();
                // Keep the invalid-target message tied to the actual
                // permissioned actor so non-familiar delivery actors explain
                // themselves correctly.
                const sourceLabel = touchDelivery?.deliveryActor
                    ? ` from ${touchDelivery.deliveryActor.name}`
                    : '';
                return {
                    isValid: false,
                    reason: `No clear line of sight${sourceLabel} to ${targetLabel} for ${ability.name}.`
                };
            }
        }

        // 4. Creature-Type Constraint Check (e.g. Hold Person: Humanoid only)
        if (targetCharacter && ability.validCreatureTypes?.length) {
            const targetTypes = [
                ...(targetCharacter.creatureTypes ?? []),
                ...(targetCharacter.stats?.creatureTypes ?? [])
            ];
            if (!CreatureTaxonomy.isValidTarget(targetTypes, {
                creatureTypes: ability.validCreatureTypes,
                excludeCreatureTypes: (ability as { excludeCreatureTypes?: string[] }).excludeCreatureTypes
            })) {
                const typeList = ability.validCreatureTypes.join(', ');
                return {
                    isValid: false,
                    reason: `${ability.name} can only target ${typeList} creatures.`
                };
            }
        }

        // 5. Logic by Targeting Type
        const structuredSpellTargeting = targetCharacter
            ? getStructuredSpellTargeting(ability)
            : null;

        if (structuredSpellTargeting && targetCharacter) {
            // Build the narrow combat-state envelope the shared spell resolver
            // needs. This keeps the hook connected to canonical spell targeting
            // without expanding its public props or duplicating combat state.
            const resolverState: CombatState = {
                characters,
                isActive: true,
                turnState: {
                    currentTurn: 0,
                    turnOrder: characters.map(character => character.id),
                    currentCharacterId: caster.id,
                    phase: 'action',
                    actionsThisTurn: []
                },
                selectedCharacterId: null,
                selectedAbilityId: null,
                actionMode: 'select',
                validTargets: [],
                validMoves: [],
                mapData,
                combatLog: [],
                reactiveTriggers: [],
                activeLightSources: []
            };
            const spellTargetReason = TargetResolver.getTargetRejectionReason(
                structuredSpellTargeting,
                caster,
                targetCharacter,
                resolverState
            );

            if (spellTargetReason) {
                return {
                    isValid: false,
                    reason: spellTargetReason.message
                };
            }
        }

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
            case 'self': {
                const isCasterTile = getOccupiedTiles(caster).some(
                    tile => tile.x === targetPosition.x && tile.y === targetPosition.y
                );
                if (!isCasterTile) {
                    return {
                        isValid: false,
                        reason: `${ability.name} can only target ${caster.name}.`
                    };
                }
                return { isValid: true };
            }
            case 'area':
                return { isValid: true };
            default:
                return {
                    isValid: false,
                    reason: `${ability.name} does not have a supported targeting rule yet.`
                };
        }
    }, [characters, mapData, getCharacterAtPosition]);

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

