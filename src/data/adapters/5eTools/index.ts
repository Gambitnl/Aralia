// Orchestrator: converts a raw 5eTools monster JSON object into Aralia's MonsterData.
// Delegates to per-concern submodules for each action category.

import { CharacterStats, Ability, AbilityEffect } from '../../../types/combat';
import { MonsterData } from '../../../types/ui';
import { Spell } from '../../../types/spells';
import { parseExtraMovementSpeedsFeet, parseWalkSpeedFeet } from '../5eToolsSpeed.js';
import {
  capitalize,
  parseSense,
  parseArmorClass,
  parseArmorSource,
  parseDamageDefenses,
  parseNonMagicalDefenses,
  parseSize,
  strip5eToolsMarkup,
  getAbilityIcon,
  parseConditionImmunities,
  extractEntryText,
  diceAverage,
} from './shared';
import { parse5eToolsAction } from './actionsAdapter';
import { parseReactions } from './reactionsAdapter';
import { parseLegendaryActions } from './legendaryAdapter';
import { parseSpellcasting } from './spellcastingAdapter';

// Word-to-number map for multiattack count parsing.
const WORD_TO_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
};

/**
 * Scales a dice formula by a multiplier. Handles formats with optional spaces
 * around the modifier, e.g. "1d10 + 8" × 3 → "3d10+24".
 */
function scaleDiceFormula(formula: string, count: number): string {
  const f = formula.replace(/\s+/g, '');
  return f.replace(
    /^(\d+)d(\d+)([+-]\d+)?$/i,
    (_, n, d, mod) => {
      const scaledN = parseInt(n) * count;
      const rawMod = mod ? parseInt(mod) * count : 0;
      const modStr = rawMod > 0 ? `+${rawMod}` : rawMod < 0 ? `${rawMod}` : '';
      return `${scaledN}d${d}${modStr}`;
    }
  );
}

/**
 * Post-processing step: locates the "Multiattack" ability (if any), parses the
 * attack count from its description, resolves the referenced sub-attack abilities
 * by name-matching, and synthesises combined damage effects so the AI can score
 * it correctly as N hits worth of damage.
 *
 * The ability's `effects[]` are pre-multiplied (N × sub-attack effects), and the
 * original `targeting` / `type` are promoted to `attack` / `single_enemy` so the
 * AI's evaluateAttackPlan branch picks it up.
 */
function enrichMultiattack(abilities: Ability[]): void {
  const multiattack = abilities.find(
    a => a.name.toLowerCase() === 'multiattack' && a.cost.type === 'action'
  );
  if (!multiattack) return;

  const desc = multiattack.description.toLowerCase();

  // Extract attack count — look for a word-numeral or digit before "attack"
  let count = 1;
  const wordMatch = desc.match(/\b(one|two|three|four|five|six|seven|eight)\b/);
  const digitMatch = desc.match(/\b(\d+)\s+(?:attacks?|rend|bite|claw|slam|strike|hit)/i);
  if (wordMatch) {
    count = WORD_TO_NUM[wordMatch[1]] ?? 1;
  } else if (digitMatch) {
    count = parseInt(digitMatch[1]) || 1;
  }

  // Build a lookup of ability names → ability.
  // Include all action-cost non-multiattack abilities (attack OR utility with damage).
  const attackMap = new Map<string, Ability>();
  for (const a of abilities) {
    if (a.id !== multiattack.id && a.cost.type === 'action') {
      const hasDamage = a.effects.some(e => e.type === 'damage') ||
        a.effects.some(e => e.type === 'damage' && e.dice);
      if (a.type === 'attack' || hasDamage) {
        attackMap.set(a.name.toLowerCase(), a);
      }
    }
  }

  // Find sub-attacks referenced by name in the description.
  // Strip trailing 's' for plural matching (e.g. "claw attacks" → ability "Claw").
  const subAttacks: Ability[] = [];
  for (const [name, ability] of attackMap) {
    const singular = name.replace(/s$/, '');
    const re = new RegExp(`\\b${singular.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (re.test(multiattack.description)) {
      subAttacks.push(ability);
    }
  }

  // If no named sub-attacks found, fall back to the highest-average-damage *physical* attack
  // (type === 'attack'). Spell abilities are excluded to prevent e.g. "Inflict Wounds"
  // being picked as a Multiattack sub-attack when "two melee attacks" is the description.
  if (subAttacks.length === 0) {
    let best: Ability | undefined;
    let bestDmg = 0;
    for (const a of attackMap.values()) {
      if (a.type !== 'attack') continue; // exclude spells
      const dmg = a.effects
        .filter(e => e.type === 'damage')
        .reduce((s, e) => s + (e.value ?? diceAverage(e.dice ?? '0')), 0);
      if (dmg > bestDmg) { bestDmg = dmg; best = a; }
    }
    if (best) subAttacks.push(best);
  }

  if (subAttacks.length === 0) return; // Nothing to synthesise from

  // Synthesise combined effects: take the highest-average-damage sub-attack × count.
  let bestSub: Ability = subAttacks[0];
  let bestSubDmg = 0;
  for (const s of subAttacks) {
    const dmg = s.effects
      .filter(e => e.type === 'damage')
      .reduce((t, e) => t + (e.value ?? diceAverage(e.dice ?? '0')), 0);
    if (dmg > bestSubDmg) { bestSubDmg = dmg; bestSub = s; }
  }

  const baseEffects = bestSub.effects.filter(e => e.type === 'damage');
  const scaledEffects: AbilityEffect[] = baseEffects.map(e => {
    const avgPerHit = e.value ?? diceAverage(e.dice ?? '0');
    const scaledDice = e.dice ? scaleDiceFormula(e.dice, count) : undefined;
    return {
      ...e,
      value: Math.round(avgPerHit * count),
      ...(scaledDice !== undefined && { dice: scaledDice }),
    };
  });

  multiattack.type = 'attack';
  multiattack.targeting = 'single_enemy';
  multiattack.range = bestSub.range;
  multiattack.effects = scaledEffects;
  multiattack.icon = '⚔️';
  multiattack.multiattackCount = count;
  multiattack.subAttackIds = subAttacks.map(s => s.id);
}

/**
 * Post-processing step: resolves legendary/bonus actions that delegate to an
 * existing ability (e.g. "makes one Rend attack", "uses Spellcasting to cast Scorching Ray").
 * Copies the referenced ability's effects, targeting, range, and type onto the
 * delegating ability so the AI can score it correctly.
 */
function enrichLegendaryDelegations(abilities: Ability[]): void {
  // Build lookup: clean name → ability (for all non-delegating abilities)
  const abilityByName = new Map<string, Ability>();
  for (const a of abilities) {
    abilityByName.set(a.name.toLowerCase(), a);
  }

  const ATTACK_DELEGATION = /makes?\s+(?:one|a)\s+([A-Za-z\s']+?)\s+attack\b/i;
  const SPELL_DELEGATION  = /\bcast(?:s|ing)?\s+([A-Z][A-Za-z\s']+?)(?:\s*\(|\.|\s+The\b|$)/;

  for (const ability of abilities) {
    // Only process abilities with no effects and a non-zero cost
    if (ability.effects.length > 0) continue;
    if (ability.cost.type === 'free') continue;

    const desc = ability.description;

    // Try attack delegation: "makes one Rend attack"
    const attackMatch = ATTACK_DELEGATION.exec(desc);
    if (attackMatch) {
      const refName = attackMatch[1].trim().toLowerCase();
      const ref = abilityByName.get(refName) ??
                  abilityByName.get(refName.replace(/s$/, '')); // singular fallback
      if (ref && ref.effects.length > 0) {
        ability.effects = [...ref.effects];
        ability.type = ref.type;
        ability.targeting = ref.targeting;
        ability.range = ref.range;
        if (ref.attackBonus !== undefined) ability.attackBonus = ref.attackBonus;
        if (ref.areaOfEffect) ability.areaOfEffect = ref.areaOfEffect;
      }
      continue;
    }

    // Try spell delegation: "cast Scorching Ray" / "uses Spellcasting to cast Fireball"
    const spellMatch = SPELL_DELEGATION.exec(desc);
    if (spellMatch) {
      const refName = spellMatch[1].trim().toLowerCase();
      // Spell abilities have IDs like "scorching_ray_will_b0" — look by clean name
      const ref = [...abilityByName.values()].find(
        a => a.name.toLowerCase() === refName && a.type === 'spell'
      );
      if (ref && ref.effects.length > 0) {
        ability.effects = [...ref.effects];
        ability.type = 'spell';
        ability.targeting = ref.targeting;
        ability.range = ref.range;
        if (ref.saveDC !== undefined) ability.saveDC = ref.saveDC;
        if (ref.saveAbility) ability.saveAbility = ref.saveAbility;
        if (ref.areaOfEffect) ability.areaOfEffect = ref.areaOfEffect;
        ability.isMagical = true;
      }
    }
  }
}

/** Returns the proficiency bonus for a given CR string (e.g. "17" → 6). */
function crToProficiencyBonus(crStr: string): number {
  const cr = parseFloat(crStr.replace(/\//, '.')) || 0; // handles "1/2", "1/4"
  if (cr <= 4) return 2;
  if (cr <= 8) return 3;
  if (cr <= 12) return 4;
  if (cr <= 16) return 5;
  if (cr <= 20) return 6;
  if (cr <= 24) return 7;
  if (cr <= 28) return 8;
  return 9;
}

// DEBT: parameter is `any` because 5etools has no published TypeScript definitions.
export function convert5eToolsMonster(
  monsterData: any,
  spellLookup?: (name: string) => Spell | undefined
): MonsterData {
  const extraMovement = parseExtraMovementSpeedsFeet(monsterData.speed);
  const crStr = monsterData.cr?.cr || (typeof monsterData.cr === 'string' ? monsterData.cr : '0');
  const profBonus = crToProficiencyBonus(crStr);
  // The combat engine formula is: d20 + dexModifier + baseInitiative
  // (dexModifier is always added by the engine from character.stats.dexterity)
  //
  // 2024 XMM: { initiative: { proficiency: N } } means initiative = DEX mod + N × profBonus.
  // Since the engine adds DEX mod separately, baseInitiative = N × profBonus only.
  //
  // 2014 MM: no initiative field → baseInitiative = 0 (engine handles DEX alone).
  const initiativeProfMult = monsterData.initiative?.proficiency ?? 0;
  const baseInitiative = initiativeProfMult * profBonus;

  const stats: CharacterStats = {
    strength: monsterData.str || 10,
    dexterity: monsterData.dex || 10,
    constitution: monsterData.con || 10,
    intelligence: monsterData.int || 10,
    wisdom: monsterData.wis || 10,
    charisma: monsterData.cha || 10,
    baseInitiative,
    speed: parseWalkSpeedFeet(monsterData.speed),
    ...(extraMovement && { extraMovementSpeeds: extraMovement }),
    senses: {
      darkvision: parseSense(monsterData.senses, 'darkvision'),
      blindsight: parseSense(monsterData.senses, 'blindsight'),
      tremorsense: parseSense(monsterData.senses, 'tremorsense'),
      truesight: parseSense(monsterData.senses, 'truesight'),
    },
    cr: crStr,
    ...(monsterData.cr?.lair && { crLair: String(monsterData.cr.lair) }),
    ...(monsterData.cr?.xpLair && { xpLair: Number(monsterData.cr.xpLair) }),
    size: parseSize(monsterData.size),
    legendaryActionsPerRound: monsterData.legendaryActions || (monsterData.legendary ? 3 : 0),
  };

  const abilities: Ability[] = [];

  if (monsterData.action) {
    monsterData.action.forEach((action: any) => {
      const ability = parse5eToolsAction(action);
      if (ability) abilities.push(ability);
    });
  }

  if (monsterData.bonus) {
    monsterData.bonus.forEach((bonus: any) => {
      const ability = parse5eToolsAction(bonus, 'bonus');
      if (ability) abilities.push(ability);
    });
  }

  abilities.push(...parseReactions(monsterData.reaction));
  abilities.push(...parseLegendaryActions(monsterData.legendary));
  abilities.push(...parseSpellcasting(monsterData.spellcasting, spellLookup));


  // Post-process: enrich Multiattack with synthesised damage and sub-attack references.
  enrichMultiattack(abilities);
  // Post-process: resolve legendary/bonus actions that delegate to existing abilities.
  enrichLegendaryDelegations(abilities);

  if (monsterData.trait) {
    monsterData.trait.forEach((trait: any) => {
      const traitText = extractEntryText(trait.entries);
      const traitName: string = trait.name;
      
      // Parse usage limits (e.g. "Legendary Resistance (3/Day)")
      const dailyMatch = traitName.match(/\((\d+)\/Day/i);
      const maxUses = dailyMatch ? parseInt(dailyMatch[1]) : undefined;
      
      abilities.push({
        id: trait.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: trait.name,
        description: strip5eToolsMarkup(traitText),
        type: 'utility',
        cost: { type: 'free' },
        targeting: 'self',
        range: 0,
        effects: [],
        icon: getAbilityIcon('utility', 'free', traitName, maxUses),
        isProficient: true,
        tags: ['passive'],
        ...(maxUses !== undefined && { maxUses, usesRemaining: maxUses }),
      });
    });
  }

  let creatureTypes: string[] = [];
  if (typeof monsterData.type === 'string') {
    creatureTypes = [capitalize(monsterData.type)];
  } else if (monsterData.type?.type) {
    creatureTypes = [capitalize(monsterData.type.type)];
    if (monsterData.type.tags) creatureTypes.push(...monsterData.type.tags.map(capitalize));
  }

  let alignment = 'Neutral';
  if (monsterData.alignment) {
    alignment = monsterData.alignment.map((a: string) => {
      switch (a) {
        case 'L': return 'Lawful';
        case 'N': return 'Neutral';
        case 'C': return 'Chaotic';
        case 'G': return 'Good';
        case 'E': return 'Evil';
        default: return a;
      }
    }).join(' ');
  }

  stats.creatureTypes = creatureTypes;
  stats.alignment = alignment;

  // Extract explicit saving throw bonuses from 5eTools `save` field.
  // These override the engine's computed abilityMod+proficiency formula so
  // monsters match their published stat blocks exactly.
  // Format: { dex: "+6", wis: "+7" } → { dex: 6, wis: 7 }
  if (monsterData.save && typeof monsterData.save === 'object') {
    const saveBonuses: Record<string, number> = {};
    for (const [key, val] of Object.entries<string>(monsterData.save)) {
      const parsed = parseInt(String(val));
      if (!isNaN(parsed)) saveBonuses[key.toLowerCase()] = parsed;
    }
    if (Object.keys(saveBonuses).length > 0) stats.saveBonuses = saveBonuses;
  }

  const resistances = parseDamageDefenses(monsterData.resist);
  const vulnerabilities = parseDamageDefenses(monsterData.vulnerable);
  const immunities = parseDamageDefenses(monsterData.immune);
  const nonMagicalResistances = parseNonMagicalDefenses(monsterData.resist);
  const nonMagicalImmunities = parseNonMagicalDefenses(monsterData.immune);
  const conditionImmunities = parseConditionImmunities(monsterData.conditionImmune);

  return {
    id: monsterData.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: monsterData.name,
    baseStats: stats,
    maxHP: monsterData.hp?.average || 10,
    hpFormula: monsterData.hp?.formula,
    abilities,
    tags: creatureTypes.map(t => t.toLowerCase()),
    armorClass: parseArmorClass(monsterData.ac),
    armorSource: parseArmorSource(monsterData.ac),
    ...(resistances.length > 0 && { resistances }),
    ...(vulnerabilities.length > 0 && { vulnerabilities }),
    ...(immunities.length > 0 && { immunities }),
    ...(nonMagicalResistances.length > 0 && { nonMagicalResistances }),
    ...(nonMagicalImmunities.length > 0 && { nonMagicalImmunities }),
    ...(conditionImmunities.length > 0 && { conditionImmunities }),
  };
}
