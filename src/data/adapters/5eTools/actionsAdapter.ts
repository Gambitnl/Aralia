// Parses the `action` array from a 5eTools monster JSON into Aralia Ability objects.

import { Ability } from '../../../types/combat';
import {
  strip5eToolsMarkup,
  extractEntryText,
  parseSaveDC,
  parseAreaOfEffect,
  parseDamageEffects,
  parseConditionEffects,
  getAbilityIcon,
} from './shared';

/**
 * Converts a single 5etools action entry into an Aralia Ability.
 * @param costType - defaults to 'action'; pass 'bonus', 'reaction', 'legendary', or 'lair' for those arrays.
 */
export function parse5eToolsAction(
  action: any,
  costType: 'action' | 'bonus' | 'reaction' | 'legendary' | 'lair' = 'action'
): Ability | null {
  const text = extractEntryText(action.entries);
  const rawName: string = action.name;
  const rechargeMatch = rawName.match(/\{@recharge\s*(\d+)\}/) || text.match(/\{@recharge\s*(\d+)\}/);
  const costMatch = rawName.match(/\(costs?\s+(\d+)\s+actions?\)/i);
  
  const cleanName = rawName
    .replace(/\s*\{@recharge\s*\d*\}/g, '')
    .replace(/\s*\(costs?\s+(\d+)\s+actions?\)/i, '')
    .trim();

  const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const description = strip5eToolsMarkup(text);

  let type: any = 'utility';
  let targeting: any = 'single_enemy';
  let range = 1;

  const { saveDC, saveAbility } = parseSaveDC(text);

  // Collect ALL reach/range values and pick the largest.
  // Handles "reach 5 ft. or range 120 ft." — for attacks, max range is the correct choice.
  const allRangeMatches = [...text.matchAll(/(?:reach|range)\s+(\d+)/gi)];
  const maxRangeFt = allRangeMatches.reduce((max, m) => Math.max(max, parseInt(m[1])), 0);
  // For "within N feet" patterns, use the FIRST occurrence (targeting range) not the max.
  // Secondary "within N feet" references (e.g. control range) are not targeting constraints.
  const firstWithinMatch = text.match(/\bwithin\s+(\d+)\s+feet/i);
  const firstWithinFt = firstWithinMatch ? parseInt(firstWithinMatch[1]) : 0;
  const hitMatch = text.match(/\{@hit\s+([+-]?\d+)\}/i);
  const hitBonus = hitMatch ? parseInt(hitMatch[1]) : undefined;
  if (text.includes('{@atk mw}') || text.includes('{@atk rw}') || text.includes('{@atkr') || text.includes('{@hit ')) {
    type = 'attack';
    const effectiveRange = Math.max(maxRangeFt, firstWithinFt);
    if (effectiveRange > 0) {
      range = Math.max(1, Math.floor(effectiveRange / 5));
    } else if (text.includes('{@atk rw}') || text.includes('{@atkr r}')) {
      range = 12;
    }
  }
  // Non-attack abilities (e.g. save-based "within 30 feet") use the FIRST "within" mention.
  if (type !== 'attack' && firstWithinFt > 5) {
    range = Math.max(1, Math.floor(firstWithinFt / 5));
  } else if (type !== 'attack' && maxRangeFt > 5) {
    range = Math.max(1, Math.floor(maxRangeFt / 5));
  }

  const areaOfEffect = parseAreaOfEffect(text);
  if (areaOfEffect) {
    targeting = 'area';
    type = 'spell';
    range = areaOfEffect.shape === 'circle' ? 12 : areaOfEffect.size;
  }

  const damageEffects = parseDamageEffects(text);
  const conditionEffects = parseConditionEffects(text);
  const effects = [...damageEffects, ...conditionEffects];

  if (damageEffects.length === 0 && type === 'attack') {
    effects.push({ type: 'damage', value: 1, damageType: 'bludgeoning' });
  }

  if (effects.length === 0 && targeting !== 'area') {
    type = 'utility';
  }

  const isMagical =
    text.includes('{@atk ms}') ||
    text.includes('{@atk rs}') ||
    type === 'spell' ||
    /\bmagical\s+(?:weapon|attack|strike|damage)\b/i.test(text) ||
    /this\s+attack(?:'s\s+damage)?\s+is\s+magical/i.test(text);

  const quantity = costMatch ? parseInt(costMatch[1]) : undefined;

  return {
    id,
    name: cleanName,
    description,
    type,
    cost: { 
      type: costType,
      ...(quantity !== undefined && { quantity })
    },
    targeting,
    range,
    effects,
    icon: getAbilityIcon(type, costType, cleanName),
    isProficient: true,
    ...(isMagical && { isMagical: true }),
    ...(hitBonus !== undefined && { attackBonus: hitBonus }),
    ...(saveDC && { saveDC }),
    ...(saveAbility && { saveAbility }),
    ...(areaOfEffect && { areaOfEffect }),
    ...(rechargeMatch && {
      recharge: { threshold: parseInt(rechargeMatch[1]), description: `Recharge ${rechargeMatch[1]}-6` },
      currentCooldown: 0,
      isRecharging: true,
    }),
  };
}
