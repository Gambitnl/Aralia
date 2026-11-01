/**
 * Carries a real spell preparation into a new battle without casting it again.
 * The saved cast owns its caster, slot level and remaining world-clock lifetime;
 * the existing spell ability factory owns its combat status mechanics. This
 * projection changes no saved character, resources, position or past outcome.
 * Map artifacts such as Light still belong to their separate light-source path.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 19:01:52
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { PlayerCharacter, Spell } from '../../types';
import type { CombatCharacter, StatusEffect } from '../../types/combat';
import type { StatusEffect as SavedStatusEffect } from '../../types/effects';
import { createAbilityFromSpell } from '../character/spellAbilityFactory';
import { isSpellCastableOutOfCombat, isPreparedConcentrationStatus } from './outOfCombatCasting';
import { isAttackRollModifierEffect } from '../../types/spells';
import { buildAttackRollActiveEffect } from '../../commands/effects/AttackRollModifierCommand';

type PreparedCast = {
  targetId: string;
  saved: SavedStatusEffect;
  spell: Spell;
  caster: PlayerCharacter;
  castLevel: number | undefined;
  remaining: number;
};

// Limit this bridge to passive roll preparations. Other spell families already
// have distinct stat/light/artifact owners; guessing their entry semantics could
// double a benefit or apply an effect that still needs a target or saving throw.
function supportsPreparedRollEntry(spell: Spell): boolean {
  return spell.effects.length > 0 && spell.effects.every(effect => isAttackRollModifierEffect(effect)
    && effect.condition.type === 'always' && !effect.damage && !effect.light);
}

/** Return only original preparation IDs whose owner stopped concentrating.
 * The exit snapshot removes these saved records instead of reviving a broken
 * ward at the next encounter. Unrecognized conditions remain with their owner.
 */
export function endedPreparedConcentrationIds(target: PlayerCharacter | undefined, combatants: readonly CombatCharacter[],
  spells: Record<string, Spell>): string[] {
  return (target?.statusEffects ?? []).filter(isPreparedConcentrationStatus).filter(saved => {
    const caster = combatants.find(actor => actor.id === saved.sourceCasterId);
    const spellId = saved.sourceSpellId ?? saved.id.slice(4, -(saved.sourceCasterId!.length + 1));
    const spell = spells[spellId];
    if (!spell || !supportsPreparedRollEntry(spell)) return false;
    return !caster || caster.currentHP <= 0 || caster.concentratingOn?.spellId !== spellId;
  }).map(saved => saved.id);
}

export function carryPreparedSpellEffects(
  combatants: CombatCharacter[],
  party: readonly PlayerCharacter[],
  spells: Record<string, Spell>,
  gameTime: Date,
): CombatCharacter[] {
  const now = gameTime instanceof Date ? gameTime.getTime() : NaN;
  if (!Number.isFinite(now)) return combatants;
  const casts: PreparedCast[] = [];
  for (const target of party) {
    for (const saved of target.statusEffects ?? []) {
      const caster = party.find(person => person.id === saved.sourceCasterId);
      const clock = saved.worldTime;
      if (!caster || !target.id || !clock || saved.duration <= 0
        || !Number.isFinite(clock.appliedAtMs) || !Number.isFinite(clock.expiresAtMs)
        || clock.expiresAtMs <= clock.appliedAtMs || now < clock.appliedAtMs) continue;
      // Older generated records lack spell metadata. Match their complete
      // source identity; a similar name or arbitrary custom condition is not a cast.
      const spell = saved.sourceSpellId ? spells[saved.sourceSpellId]
        : Object.values(spells).find(candidate => saved.id === `ooc-${candidate.id}-${caster.id}`);
      if (!spell || saved.id !== `ooc-${spell.id}-${caster.id}`
        || saved.source !== spell.name || saved.name !== spell.name
        || !isSpellCastableOutOfCombat(spell) || !supportsPreparedRollEntry(spell)
        || saved.requiresConcentration !== undefined
          && saved.requiresConcentration !== Boolean(spell.duration.concentration)) continue;
      const castLevel = saved.sourceCastLevel ?? (spell.level === 0 ? 0 : undefined);
      if (castLevel !== undefined && (!Number.isInteger(castLevel)
        || castLevel < spell.level || castLevel > 9 || spell.level === 0 && castLevel !== 0)) continue;
      casts.push({ targetId: target.id, saved, spell, caster, castLevel,
        remaining: Math.min(saved.duration, Math.ceil((clock.expiresAtMs - now) / 6000)) });
    }
  }
  // Normal status application ends the caster's previous concentration. If an
  // older save contains contradictory casts, do not guess which one survived or
  // invent a slot level. Other casters and non-concentration preparations remain.
  const concentrationKeys = new Map<string, Set<string>>();
  for (const cast of casts.filter(cast => cast.spell.duration.concentration)) {
    const keys = concentrationKeys.get(cast.caster.id) ?? new Set<string>();
    keys.add(`${cast.spell.id}:${cast.saved.worldTime!.appliedAtMs}:${cast.castLevel ?? 'unknown'}`);
    concentrationKeys.set(cast.caster.id, keys);
  }
  const surviving = casts.filter(cast => cast.remaining > 0 && (!cast.spell.duration.concentration
    || cast.castLevel !== undefined && concentrationKeys.get(cast.caster.id)?.size === 1));
  const projected = surviving.flatMap(cast => createAbilityFromSpell(cast.spell, cast.caster).effects
    .filter(effect => effect.type === 'status' && effect.statusEffect)
    .map(effect => ({ cast, status: {
      ...structuredClone(cast.saved), ...structuredClone(effect.statusEffect!),
      id: `${cast.saved.id}:${cast.targetId}:${effect.statusEffect!.id}`,
      source: cast.spell.name, sourceSpellId: cast.spell.id, sourceCasterId: cast.caster.id,
      duration: cast.remaining,
    } as StatusEffect })));
  // Weapon and spell attacks read live active effects, while the status list
  // supplies the condition display. Reuse the cast command's payload builder so
  // a prepared ward reaches the actual roll rather than becoming a UI-only buff.
  // Entry must never rerun a save, damage payload or other conditional casting.
  const rollEffects = surviving.flatMap(cast => cast.spell.effects
    .filter(isAttackRollModifierEffect)
    .filter(effect => effect.condition.type === 'always' && !effect.damage)
    .map((effect, index) => ({ cast, effect: {
      ...buildAttackRollActiveEffect(effect, {
        id: `${cast.saved.id}:${cast.targetId}:roll:${index}`,
        spellId: cast.spell.id, casterId: cast.caster.id,
        sourceName: cast.spell.name, currentTurn: 0,
      }),
      // The world-clock remainder wins over a fresh cast's full duration.
      duration: { type: 'rounds' as const, value: cast.remaining },
    } })));
  return combatants.map(actor => {
    const additions = projected.filter(item => item.cast.targetId === actor.id).map(item => item.status);
    const activeAdditions = rollEffects.filter(item => item.cast.targetId === actor.id).map(item => item.effect);
    const concentration = surviving.find(cast => cast.caster.id === actor.id && cast.spell.duration.concentration);
    if (!additions.length && !activeAdditions.length && !concentration) return actor;
    const ids = new Set(additions.map(effect => effect.id));
    const activeIds = new Set(activeAdditions.map(effect => effect.id));
    return { ...actor,
      statusEffects: [...actor.statusEffects.filter(effect => !ids.has(effect.id)), ...additions],
      activeEffects: [...(actor.activeEffects ?? []).filter(effect => !activeIds.has(effect.id)), ...activeAdditions],
      ...(concentration ? { concentratingOn: {
        spellId: concentration.spell.id, spellName: concentration.spell.name,
        spellLevel: concentration.castLevel!, startedTurn: 0, canDropAsFreeAction: true,
        effectIds: [
          ...projected.filter(item => item.cast.caster.id === actor.id
            && item.cast.spell.id === concentration.spell.id).map(item => item.status.id),
          ...rollEffects.filter(item => item.cast.caster.id === actor.id
            && item.cast.spell.id === concentration.spell.id).map(item => item.effect.id),
        ],
      } } : {}),
    };
  });
}
