/**
 * @file hooks/useAbilitySystem.ts
 * Manages ability selection, targeting, and execution logic for combat.
 */
import { useState, useCallback } from 'react';
import { 
  CombatCharacter, 
  Ability, 
  Position, 
  AreaOfEffect, 
  CombatAction,
  BattleMapData
} from '../types/combat';
import { getDistance, calculateDamage, generateId } from '../utils/combatUtils';
import { hasLineOfSight } from '../utils/lineOfSight';

interface UseAbilitySystemProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onExecuteAction: (action: CombatAction) => boolean;
  onCharacterUpdate: (character: CombatCharacter) => void;
}

export const useAbilitySystem = ({
  characters,
  mapData,
  onExecuteAction,
  onCharacterUpdate
}: UseAbilitySystemProps) => {
  const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null);
  const [targetingMode, setTargetingMode] = useState<boolean>(false);
  const [aoePreview, setAoePreview] = useState<{
    center: Position;
    affectedTiles: Position[];
    ability: Ability;
  } | null>(null);
  
  const getCharacterAtPosition = useCallback((position: Position): CombatCharacter | null => {
    return characters.find(char => 
      char.position.x === position.x && char.position.y === position.y
    ) || null;
  }, [characters]);


  const isValidTarget = useCallback((
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position
  ): boolean => {
    if(!mapData) return false;
    
    const startTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
    const endTile = mapData.tiles.get(`${targetPosition.x}-${targetPosition.y}`);
    if(!startTile || !endTile) return false;

    const distance = getDistance(caster.position, targetPosition);
    if (distance > ability.range) return false;
    
    if (ability.type === 'attack' || ability.type === 'spell') {
      if (!hasLineOfSight(startTile, endTile, mapData)) {
        return false;
      }
    }
    
    const targetCharacter = getCharacterAtPosition(targetPosition);
    
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
  
  const getValidTargets = useCallback((
    ability: Ability, 
    caster: CombatCharacter
  ): Position[] => {
    if(!mapData) return [];
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

  const calculateAoE = useCallback((
    aoe: AreaOfEffect,
    center: Position,
    caster?: CombatCharacter
  ): Position[] => {
    if(!mapData) return [];
    const affectedTiles: Position[] = [];
    
    switch (aoe.shape) {
      case 'circle':
        for (let x = center.x - aoe.size; x <= center.x + aoe.size; x++) {
          for (let y = center.y - aoe.size; y <= center.y + aoe.size; y++) {
            if (x >= 0 && x < mapData.dimensions.width && y >= 0 && y < mapData.dimensions.height) {
              if (getDistance(center, { x, y }) <= aoe.size) {
                affectedTiles.push({ x, y });
              }
            }
          }
        }
        break;
      // Other shapes can be implemented here
    }
    return affectedTiles;
  }, [mapData]);

  const cancelTargeting = useCallback(() => {
    setSelectedAbility(null);
    setTargetingMode(false);
    setAoePreview(null);
  }, []);

  const applyAbilityEffects = useCallback((
    ability: Ability,
    caster: CombatCharacter,
    target: CombatCharacter
  ) => {
    let modifiedTarget = {...target};
    ability.effects.forEach(effect => {
      switch (effect.type) {
        case 'damage':
          const damage = calculateDamage(effect.value || 0, caster, target);
          modifiedTarget.currentHP = Math.max(0, modifiedTarget.currentHP - damage);
          break;
        case 'heal':
          const healAmount = effect.value || 0;
          modifiedTarget.currentHP = Math.min(modifiedTarget.maxHP, modifiedTarget.currentHP + healAmount);
          break;
      }
    });
    onCharacterUpdate(modifiedTarget);
  }, [onCharacterUpdate]);
  
  const executeAbility = useCallback((
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position,
    targetCharacterIds: string[]
  ) => {
    const action: CombatAction = {
      id: generateId(),
      characterId: caster.id,
      type: 'ability',
      abilityId: ability.id,
      targetPosition,
      targetCharacterIds,
      cost: ability.cost,
      timestamp: Date.now()
    };
    
    const success = onExecuteAction(action);
    if (success) {
      targetCharacterIds.forEach(targetId => {
        const target = characters.find(c => c.id === targetId);
        if (target) {
          applyAbilityEffects(ability, caster, target);
        }
      });
      
      if (ability.cooldown) {
        const updatedCaster = {
          ...caster,
          abilities: caster.abilities.map(a => 
            a.id === ability.id ? { ...a, currentCooldown: ability.cooldown } : a
          )
        };
        onCharacterUpdate(updatedCaster);
      }
    }
    
    cancelTargeting();
  }, [onExecuteAction, characters, applyAbilityEffects, onCharacterUpdate, cancelTargeting]);


  const startTargeting = useCallback((ability: Ability, caster: CombatCharacter) => {
    setSelectedAbility(ability);
    setTargetingMode(true);
    
    if (ability.targeting === 'self') {
      executeAbility(ability, caster, caster.position, [caster.id]);
      return;
    }
  }, [executeAbility]);

  const selectTarget = useCallback((targetPosition: Position, caster: CombatCharacter) => {
    if (!selectedAbility) return;
    
    let targetCharacterIds: string[] = [];
    
    if (selectedAbility.areaOfEffect) {
      const affectedTiles = calculateAoE(selectedAbility.areaOfEffect, targetPosition, caster);
      targetCharacterIds = characters
        .filter(char => affectedTiles.some(tile => 
          tile.x === char.position.x && tile.y === char.position.y
        ))
        .map(char => char.id);
    } else {
      const targetCharacter = getCharacterAtPosition(targetPosition);
      if (targetCharacter) {
        targetCharacterIds = [targetCharacter.id];
      }
    }
    
    executeAbility(selectedAbility, caster, targetPosition, targetCharacterIds);
  }, [selectedAbility, characters, calculateAoE, getCharacterAtPosition, executeAbility]);

  const previewAoE = useCallback((position: Position, caster: CombatCharacter) => {
    if (!selectedAbility?.areaOfEffect) return;
    
    const affectedTiles = calculateAoE(selectedAbility.areaOfEffect, position, caster);
    setAoePreview({
      center: position,
      affectedTiles,
      ability: selectedAbility
    });
  }, [selectedAbility, calculateAoE]);


  return {
    selectedAbility,
    targetingMode,
    aoePreview,
    getValidTargets,
    startTargeting,
    selectTarget,
    cancelTargeting,
    previewAoE,
    isValidTarget
  };
};