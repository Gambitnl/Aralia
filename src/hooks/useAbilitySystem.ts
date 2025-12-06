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
  BattleMapData,
  CombatState,
  CombatLogEntry
} from '../types/combat';
import { Spell } from '../types/spells'; // Import Spell type
import { SpellCommandFactory, CommandExecutor } from '../commands'; // Import Command System
import { BreakConcentrationCommand } from '../commands/effects/ConcentrationCommands'; // Import Break Concentration
import { getDistance, calculateDamage, generateId } from '../utils/combatUtils';
import { hasLineOfSight } from '../utils/lineOfSight';

interface UseAbilitySystemProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onExecuteAction: (action: CombatAction) => boolean;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onAbilityEffect?: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
  onLogEntry?: (entry: CombatLogEntry) => void; // Added for Command Pattern logging
  onRequestInput?: (spell: Spell, onConfirm: (input: string) => void) => void; // New prop for AI Input
}

export const useAbilitySystem = ({
  characters,
  mapData,
  onExecuteAction,
  onCharacterUpdate,
  onAbilityEffect,
  onLogEntry,
  onRequestInput
}: UseAbilitySystemProps) => {
  const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null);
  const [targetingMode, setTargetingMode] = useState<boolean>(false);
  const [aoePreview, setAoePreview] = useState<{
    center: Position;
    affectedTiles: Position[];
    ability: Ability;
  } | null>(null);

  // ... (legacy code)

  // --- Command Pattern Integration ---
  const executeSpell = useCallback(async (
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    playerInput?: string
  ) => {
    // 0. Check for AI Input Requirements
    if (spell.arbitrationType === 'ai_dm' && spell.aiContext?.playerInputRequired && !playerInput) {
      if (onRequestInput) {
        onRequestInput(spell, (input) => {
          executeSpell(spell, caster, targets, castAtLevel, input);
        });
        return; // Halt execution until input is provided
      } else {
        console.warn("Spell requires input but no onRequestInput handler provided.");
      }
    }

    // 1. Construct temporary CombatState
    const currentState: CombatState = {
      isActive: true,
      characters: characters,
      turnState: {} as any, // Mock, commands usually don't read this
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [] // Start empty to capture new entries
    };

    // 2. Create Commands
    // We assume GameState isn't critical for basic effects yet, or we'd need to pass it in.
    // For now, we mock what's needed or pass a minimal object.
    const mockGameState: any = {
      // Add necessary GameState fields if factory needs them
    };

    const commands = await SpellCommandFactory.createCommands(
      spell,
      caster,
      targets,
      castAtLevel,
      mockGameState,
      playerInput
    );

    // 3. Execute
    const result = CommandExecutor.execute(commands, currentState);

    if (result.success) {
      // 4. Propagate State Changes
      result.finalState.characters.forEach(finalChar => {
        // Simple check if changed (reference equality might fail if deep cloned, 
        // but BaseEffectCommand updates by mapping)
        // We should probably just update any character involved in the command.
        // Or comparing JSON stringify if we want to be sure.
        // For now, update all targets + caster to be safe.
        const isTarget = targets.some(t => t.id === finalChar.id);
        const isCaster = caster.id === finalChar.id;

        if (isTarget || isCaster) {
          onCharacterUpdate(finalChar);
        }
      });

      // 5. Propagate Log Entries
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }

      // 6. Trigger Animations (Optional / TODO)
      // We could iterate result.executedCommands and trigger visual effects
    } else {
      console.error("Spell execution failed:", result.error);
    }
  }, [characters, onCharacterUpdate, onLogEntry, onRequestInput]);


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
    if (!mapData) return false;

    const startTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
    const endTile = mapData.tiles.get(`${targetPosition.x}-${targetPosition.y}`);
    if (!startTile || !endTile) return false;

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

  const calculateAoE = useCallback((
    aoe: AreaOfEffect,
    center: Position,
    caster?: CombatCharacter
  ): Position[] => {
    if (!mapData) return [];
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
    // Clone once so we can safely layer mutations in this pass.
    let modifiedTarget = { ...target, statusEffects: [...target.statusEffects] };
    ability.effects.forEach(effect => {
      switch (effect.type) {
        case 'damage':
          const damage = calculateDamage(effect.value || 0, caster, target);
          modifiedTarget.currentHP = Math.max(0, modifiedTarget.currentHP - damage);
          if (onAbilityEffect) onAbilityEffect(damage, target.position, 'damage');
          break;
        case 'heal':
          const healAmount = effect.value || 0;
          modifiedTarget.currentHP = Math.min(modifiedTarget.maxHP, modifiedTarget.currentHP + healAmount);
          if (onAbilityEffect) onAbilityEffect(healAmount, target.position, 'heal');
          break;
        case 'status': {
          // Apply buffs/debuffs and extend duration if provided on the effect payload.
          const statusEffect = effect.statusEffect;
          if (statusEffect) {
            const effectDuration = effect.duration ?? statusEffect.duration ?? 1;
            modifiedTarget.statusEffects.push({
              ...statusEffect,
              duration: effectDuration,
              id: statusEffect.id || generateId(),
            });
          }
          break;
        }
      }
    });
    onCharacterUpdate(modifiedTarget);
  }, [onCharacterUpdate, onAbilityEffect]);

  const executeAbility = useCallback((
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position,
    targetCharacterIds: string[]
  ) => {
    // NEW: Bridge to Spell System
    if (ability.spell) {
      // Resolve targets
      const targets = targetCharacterIds
        .map(id => characters.find(c => c.id === id))
        .filter((c): c is CombatCharacter => !!c);

      // Cast at base level for now (TODO: Spell Slots / Upcasting UI)
      executeSpell(ability.spell, caster, targets, ability.spell.level);
      cancelTargeting();
      return;
    }

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



  const dropConcentration = useCallback((character: CombatCharacter) => {
    if (!character.concentratingOn) return;

    // 1. Construct temporary CombatState
    const currentState: CombatState = {
      isActive: true,
      characters: characters,
      turnState: {} as any,
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: []
    };

    // 2. Create Command
    const command = new BreakConcentrationCommand({
      spellId: character.concentratingOn.spellId,
      spellName: character.concentratingOn.spellName,
      caster: character,
      targets: [],
      castAtLevel: character.concentratingOn.spellLevel,
      gameState: {} as any,
    });

    // 3. Execute
    const result = CommandExecutor.execute([command], currentState);

    if (result.success) {
      // 4. Propagate
      result.finalState.characters.forEach(finalChar => {
        if (finalChar.id === character.id) {
          onCharacterUpdate(finalChar);
        }
      });

      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }
    }
  }, [characters, onCharacterUpdate, onLogEntry]);

  return {
    selectedAbility,
    targetingMode,
    aoePreview,
    getValidTargets,
    startTargeting,
    selectTarget,
    cancelTargeting,
    previewAoE,
    isValidTarget,
    executeSpell,
    dropConcentration,
  };
};
