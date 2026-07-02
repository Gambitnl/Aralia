/**
 * @file src/systems/gameEntry/preRollBuffOffer.ts
 *
 * Pre-roll buff offers for the hostile-opening de-escalation check: detect
 * which of the character's KNOWN check-boosting spells (Guidance, Enhance
 * Ability, …) could help the skill about to be rolled, and build the
 * StatusEffect a real cast would apply.
 *
 * Detection is DATA-DRIVEN off the spell JSON (`effects[].abilityCheckModifier`
 * with `appliesTo: 'ability_check'`), not a hard-coded name list. The built
 * StatusEffect mirrors the exact shapes the combat engine produces
 * (UtilityCommand.applyAbilityCheckModifier / EnhanceAbilityCommand) so
 * `getActiveCheckBoosts` and `checkUtils.collectStructuredAbilityCheckBonuses`
 * read it identically to an in-combat cast.
 */
import type { PlayerCharacter } from '../../types';
import type { StatusEffect } from '../../types/effects';
import { generateId } from '../../utils/core/idGenerator';
import { getActiveCheckBoosts } from './runDeEscalationCheck';

/**
 * The slice of a spell definition this module reads. Kept structural (rather
 * than importing the full Spell type) so it tolerates the evolving spell
 * schema — these fields are stable across guidance.json / enhance-ability.json.
 */
export interface CheckBoostSpellShape {
  id: string;
  name: string;
  level: number;
  duration?: { type?: string; value?: number; unit?: string; concentration?: boolean };
  /** Effect entries as opaque objects; the payload is narrowed at runtime so
   *  the full (and evolving) Spell effect union assigns without friction. */
  effects?: ReadonlyArray<object>;
}

interface AbilityCheckPayload {
  appliesTo?: string;
  bonusDice?: string;
  flatModifier?: string | number;
  skillSelection?: string;
  [key: string]: unknown;
}

export interface PreRollBuffOffer {
  spellId: string;
  spellName: string;
  /** The spell's own level (0 = cantrip). */
  level: number;
  /** Slot level the cast will consume; 0 for cantrips (free). */
  castAtLevel: number;
  kind: 'bonus-dice' | 'advantage';
  /** Present for kind 'bonus-dice', e.g. '1d4'. */
  bonusDice?: string;
  /** Player-facing cost line ("free" / "uses a level-2 spell slot"). */
  costLabel: string;
}

/** The ability-check payload of a spell, if it has one (runtime-narrowed). */
function checkPayloadOf(spell: CheckBoostSpellShape): AbilityCheckPayload | undefined {
  for (const effect of spell.effects ?? []) {
    const payload = (effect as Record<string, unknown>)?.abilityCheckModifier as AbilityCheckPayload | undefined;
    if (payload && payload.appliesTo === 'ability_check') return payload;
  }
  return undefined;
}

/** Lowest spell-slot level ≥ the spell's level with a slot available; null if none. */
function lowestCastableLevel(character: PlayerCharacter, spellLevel: number): number | null {
  if (spellLevel === 0) return 0;
  for (let lvl = spellLevel; lvl <= 9; lvl += 1) {
    const vial = character.spellSlots?.[`level_${lvl}` as keyof typeof character.spellSlots];
    if (vial && vial.current > 0) return lvl;
  }
  return null;
}

/**
 * Which of the given (already-resolved) spells are worth offering before a
 * roll of `skillName`? A spell qualifies when it carries an ability-check
 * payload, the character can pay for it, and an equivalent boost isn't
 * already active for this skill.
 */
export function findPreRollBuffOffers(args: {
  character: PlayerCharacter;
  skillName: string;
  spells: CheckBoostSpellShape[];
}): PreRollBuffOffer[] {
  const { character, skillName, spells } = args;
  const activeBoosts = getActiveCheckBoosts(character, skillName);
  const hasDice = activeBoosts.some((b) => !!b.bonusDice);
  const hasAdvantage = activeBoosts.some((b) => b.advantage);

  const offers: PreRollBuffOffer[] = [];
  for (const spell of spells) {
    const payload = checkPayloadOf(spell);
    if (!payload) continue;

    const kind: PreRollBuffOffer['kind'] | null =
      payload.flatModifier === 'advantage' ? 'advantage'
        : payload.bonusDice ? 'bonus-dice'
          : null;
    if (!kind) continue;
    if (kind === 'advantage' && hasAdvantage) continue;
    if (kind === 'bonus-dice' && hasDice) continue;

    const castAtLevel = lowestCastableLevel(character, spell.level);
    if (castAtLevel === null) continue;

    offers.push({
      spellId: spell.id,
      spellName: spell.name,
      level: spell.level,
      castAtLevel,
      kind,
      bonusDice: kind === 'bonus-dice' ? payload.bonusDice : undefined,
      costLabel: castAtLevel === 0 ? 'free' : `uses a level-${castAtLevel} spell slot`,
    });
  }

  // Cheapest help first: cantrips, then ascending slot cost.
  return offers.sort((a, b) => a.castAtLevel - b.castAtLevel);
}

/**
 * Duration in combat rounds, matching the engine's normalization
 * (EnhanceAbilityCommand.getDurationRounds): minutes ×10, hours ×600.
 */
function durationRounds(spell: CheckBoostSpellShape): number {
  const d = spell.duration;
  if (!d) return 10;
  const value = d.value ?? 1;
  if (d.unit === 'round') return Math.max(1, value);
  if (d.unit === 'minute') return Math.max(1, value) * 10;
  return Math.max(1, value) * 600;
}

/**
 * The StatusEffect a real cast of this spell applies for `skillName`,
 * mirroring the combat engine's shapes so every downstream reader
 * (getActiveCheckBoosts, checkUtils) treats it identically:
 *  - bonus-dice → UtilityCommand.applyAbilityCheckModifier's shape
 *  - advantage  → EnhanceAbilityCommand.createStatusEffect's shape,
 *    additionally scoped to the rolled skill via modifiers.skill (the offer
 *    is cast FOR this check, so the tighter scope is the honest one).
 */
export function buildCheckBoostStatusEffect(args: {
  spell: CheckBoostSpellShape;
  skillName: string;
  casterId: string;
}): StatusEffect {
  const { spell, skillName, casterId } = args;
  const payload = checkPayloadOf(spell);
  const advantage = payload?.flatModifier === 'advantage';

  if (advantage) {
    return {
      id: generateId(),
      name: `${spell.name} (${skillName})`,
      type: 'buff',
      description: `Advantage on ${skillName} ability checks.`,
      duration: durationRounds(spell),
      source: spell.name,
      sourceCasterId: casterId,
      effect: { type: 'condition' },
      modifiers: { advantage: ['check'], skill: skillName },
      visualEffect: 'enhance-ability',
    };
  }

  return {
    id: generateId(),
    name: `${spell.name} (${skillName})`,
    type: 'buff',
    duration: durationRounds(spell),
    source: spell.name,
    sourceCasterId: casterId,
    description: `${skillName} checks gain ${payload?.bonusDice ?? ''}.`,
    effect: { type: 'condition' },
    modifiers: { skill: skillName },
    abilityCheckModifier: { ...payload },
    visualEffect: 'guidance',
  };
}
