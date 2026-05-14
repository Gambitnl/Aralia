import { AbilityEffect, TargetingType } from '../../../types/combat';
import { Spell, SpellEffect } from '../../../types/spells';
import { diceAverage } from './shared';

/**
 * Maps a rich Spell object (from Aralia's spell database) into 
 * lightweight Ability properties used by the combat engine.
 */
export function mapSpellToAbilityProperties(spell: Spell): {
  effects: AbilityEffect[];
  targeting: TargetingType;
  range: number;
  areaShape?: 'circle' | 'cone' | 'line' | 'square';
  areaSize?: number;
} {
  const effects: AbilityEffect[] = spell.effects.map(mapSpellEffectToAbilityEffect).filter((e): e is AbilityEffect => e !== null);
  
  let targeting: TargetingType = 'single_enemy';
  let range = 1;
  let areaShape: any;
  let areaSize: number | undefined;

  // Map targeting
  switch (spell.targeting.type) {
    case 'single':
      targeting = 'single_enemy';
      range = Math.max(1, Math.floor(spell.targeting.range / 5));
      break;
    case 'multi':
      targeting = 'single_enemy'; // Multi-targeting is handled by the engine's target selection
      range = Math.max(1, Math.floor(spell.targeting.range / 5));
      break;
    case 'area':
      targeting = 'area';
      range = Math.max(1, Math.floor(spell.targeting.range / 5));
      if (spell.targeting.areaOfEffect) {
        areaSize = Math.max(1, Math.floor(spell.targeting.areaOfEffect.size / 5));
        switch (spell.targeting.areaOfEffect.shape) {
          case 'Sphere':
          case 'Circle':
          case 'Cylinder':
          case 'Emanation':
            areaShape = 'circle';
            break;
          case 'Cone':
            areaShape = 'cone';
            break;
          case 'Line':
            areaShape = 'line';
            break;
          case 'Cube':
          case 'Square':
            areaShape = 'square';
            break;
        }
      }
      break;
    case 'self':
      targeting = 'self';
      range = 0;
      break;
    case 'point':
      targeting = 'area';
      range = Math.max(1, Math.floor(spell.targeting.range / 5));
      break;
  }

  // Correct targeting for healing/buff spells: if ALL effects are heal/status-buff type
  // (no damage), the spell should target allies, not enemies.
  if (targeting === 'single_enemy' && effects.length > 0) {
    const hasAnyDamage = effects.some(e => e.type === 'damage');
    const hasBeneficialEffect = effects.some(e => e.type === 'heal');
    const isTaggedBuff = spell.tags?.includes('buff') ?? false;
    if (!hasAnyDamage && (hasBeneficialEffect || isTaggedBuff)) {
      targeting = 'single_ally';
    }
  }
  // 'multi'-targeted buff spells (e.g. Bless: up to 3 allies) also need ally targeting.
  if (targeting === 'single_enemy' && spell.targeting.type === 'multi') {
    const hasAnyDamage = effects.some(e => e.type === 'damage');
    const isTaggedBuff = spell.tags?.includes('buff') ?? false;
    const hasBeneficialEffect = effects.some(e => e.type === 'heal');
    if (!hasAnyDamage && (hasBeneficialEffect || isTaggedBuff)) {
      targeting = 'single_ally';
    }
  }

  // Propagate creature-type constraints (e.g. Hold Person: Humanoid only).
  const creatureTypeFilter: string[] | undefined =
    spell.targeting.filter?.creatureTypes?.length
      ? spell.targeting.filter.creatureTypes
      : undefined;

  return {
    effects,
    targeting,
    range,
    ...(areaShape && { areaShape }),
    ...(areaSize && { areaSize }),
    ...(creatureTypeFilter && { validCreatureTypes: creatureTypeFilter }),
  };
}

/** Known buff status condition names (case-insensitive) to resolve the debuff-default gap. */
const BUFF_CONDITIONS = new Set([
  'blessed', 'bless', 'guided', 'inspired', 'sanctuary', 'haste', 'invisible',
  'concentration', 'concentrating', 'hidden', 'flying',
]);

function isBuffCondition(name: string): boolean {
  return BUFF_CONDITIONS.has(name.toLowerCase());
}

function mapSpellEffectToAbilityEffect(effect: SpellEffect): AbilityEffect | null {
  switch (effect.type) {
    case 'DAMAGE': {
      // Spell data may store compound types like "Radiant/Necrotic" (player's choice).
      // Take the first option so the engine always receives a concrete damage type.
      const rawType = effect.damage.type.toLowerCase().split('/')[0].trim();
      const mappedType = rawType === 'cold' ? 'ice' : rawType;
      return {
        type: 'damage',
        dice: effect.damage.dice,
        damageType: mappedType as any,
        value: Math.round(diceAverage(effect.damage.dice ?? '')),
      };
    }
    case 'HEALING':
      return {
        type: 'heal',
        dice: effect.healing.dice,
        value: Math.round(diceAverage(effect.healing.dice ?? '')),
      };
    case 'STATUS_CONDITION': {
      const condName = effect.statusCondition.name;
      return {
        type: 'status',
        statusEffect: {
          id: condName.toLowerCase(),
          name: condName,
          type: isBuffCondition(condName) ? 'buff' : 'debuff',
          duration: effect.statusCondition.duration.value || 1,
        },
      };
    }
    case 'MOVEMENT': {
      let dist = effect.distance || 0;
      if (dist === 0 && effect.forcedMovement?.maxDistance) {
        const m = effect.forcedMovement.maxDistance.match(/(\d+)/);
        if (m) dist = parseInt(m[1]);
      }
      return {
        type: effect.movementType === 'teleport' ? 'teleport' : 'movement',
        value: Math.max(dist > 0 ? 1 : 0, Math.floor(dist / 5)),
      };
    }
    default:
      return null;
  }
}



