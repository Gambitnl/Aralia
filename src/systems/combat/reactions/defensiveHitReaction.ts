/**
 * Resolves the existing when-hit defense before weapon or spell damage is committed.
 * Both attack owners await this decision. The shared economy pays the quoted grant
 * or slot once; DefensiveCommand owns the AC effect and normal turn-start expiry.
 * Critical hits stay automatic hits, but the player may still protect later attacks.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 10:56:56
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/spell/spellAttack.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter, CombatState, ReactionSpellOption } from '@/types/combat';
import type { Spell, SpellEffect } from '@/types/spells';
import type { CommandContext } from '@/commands/base/SpellCommand';
import { DefensiveCommand } from '@/commands/effects/DefensiveCommand';
import { canAffordActionCost, consumeActionCost, getReactionSpellCost } from '@/utils/combat/actionEconomyUtils';
import { isIncapacitated } from '@/utils/combat/deathSaveUtils';
import { generateId } from '@/utils/combat';

export async function resolveDefensiveHitReaction(
  state: CombatState, attacker: CombatCharacter, target: CombatCharacter,
  attackRoll: number, coverBonus: number, context: CommandContext, isCritical = false,
): Promise<{ state: CombatState; target: CombatCharacter; targetAC: number; isHit: boolean }> {
  const originalAC = (target.armorClass || 10) + coverBonus;
    if (!context.requestReaction || target.currentHP <= 0 || isIncapacitated(target)) {
      return { state, target, targetAC: originalAC, isHit: true };
    }

    const reactionSpells = (target.abilities || [])
      .map(abilityOption => abilityOption.spell)
      .filter((spellOption): spellOption is Spell => {
        if (!spellOption) return false;
        const reactionCost = getReactionSpellCost(target, spellOption);

        return String(spellOption.castingTime?.unit ?? '').toLowerCase().includes('reaction') &&
          spellOption.effects.some((effect: SpellEffect) =>
            effect.type === 'DEFENSIVE' &&
            effect.reactionTrigger?.event === 'when_hit'
          ) &&
          canAffordActionCost(target, reactionCost);
      });

    if (reactionSpells.length === 0) {
      return {
        state,
        target,
        targetAC: (target.armorClass || 10) + coverBonus,
        isHit: true
      };
    }

    // A preview reads the declared AC effect; it never executes a command,
    // rolls dice or spends a resource. Unknown defense formulas stay unquoted.
    const options: ReactionSpellOption[] = reactionSpells.map(spell => {
      const defenses = spell.effects.filter(effect => effect.type === 'DEFENSIVE' && effect.reactionTrigger?.event === 'when_hit');
      const bonuses = defenses.map(effect => effect.type === 'DEFENSIVE' && effect.defenseType === 'ac_bonus'
        ? effect.acBonus ?? (effect as { value?: number }).value : undefined);
      const knownBonus = bonuses.length > 0 && bonuses.every(value => typeof value === 'number' && Number.isFinite(value));
      const defendedAC = knownBonus ? originalAC + bonuses.reduce<number>((sum, value) => sum + (value ?? 0), 0) : undefined;
      return { ...spell, hitPreview: { attackTotal: attackRoll, currentAC: originalAC, defendedAC, isCritical,
        stopsAttack: defendedAC === undefined ? undefined : !isCritical && attackRoll < defendedAC } };
    });
    const selectedReactionId = await context.requestReaction(
      attacker.id,
      target.id,
      'on_hit',
      options
    );
    const selectedReactionSpell = reactionSpells.find(spellOption => spellOption.id === selectedReactionId);

    if (!selectedReactionSpell) {
      return {
        state,
        target,
        targetAC: (target.armorClass || 10) + coverBonus,
        isHit: true
      };
    }

    const reactionCost = getReactionSpellCost(target, selectedReactionSpell);
    const targetAfterCost = consumeActionCost(target, reactionCost);
    let reactionState: CombatState = {
      ...state,
      characters: state.characters.map(character =>
        character.id === targetAfterCost.id ? targetAfterCost : character
      )
    };

    const source = reactionCost.castSource;
    const grant = source?.type === 'feat' ? target.limitedUses?.[`feat_${source.featId}_${source.spellId}`] : undefined;
    const paidResource = grant ? `a free cast from ${grant.name}`
      : reactionCost.spellSlotLevel ? `a level ${reactionCost.spellSlotLevel} spell slot` : 'no spell slot';
    reactionState.combatLog = [...reactionState.combatLog, {
      id: generateId(), timestamp: Date.now(), type: 'action', characterId: target.id,
      message: `${target.name} casts ${selectedReactionSpell.name}, spending a reaction and ${paidResource}.`,
      data: { spellId: selectedReactionSpell.id, notes: JSON.stringify({ paidResource: reactionCost }) },
    }];

    // Shield-style cancellation needs the defensive AC change before damage
    // commands run. Apply only defensive when-hit spell rows here; broader
    // reaction spell orchestration remains owned by the hook-level prompt lane.
    for (const effect of selectedReactionSpell.effects) {
      if (effect.type !== 'DEFENSIVE' || effect.reactionTrigger?.event !== 'when_hit') {
        continue;
      }

      const liveTarget = reactionState.characters.find(character => character.id === target.id) || targetAfterCost;
      const command = new DefensiveCommand(effect, {
        ...context,
        spellId: selectedReactionSpell.id,
        spellName: selectedReactionSpell.name,
        caster: liveTarget,
        targets: [liveTarget]
      });
      reactionState = command.execute(reactionState);
    }

    const defendedTarget = reactionState.characters.find(character => character.id === target.id) || targetAfterCost;
    const defendedTargetAC = (defendedTarget.armorClass || 10) + coverBonus;
    const stillHits = isCritical || attackRoll >= defendedTargetAC;

    if (!stillHits) {
      reactionState = {
        ...reactionState,
        combatLog: [
          ...(reactionState.combatLog || []),
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `${defendedTarget.name}'s ${selectedReactionSpell.name} raises AC to ${defendedTargetAC} and turns the hit into a miss.`,
            characterId: defendedTarget.id,
            targetIds: [defendedTarget.id]
          }
        ]
      };
    }

    return {
      state: reactionState,
      target: defendedTarget,
      targetAC: defendedTargetAC,
      isHit: stillHits
    };
}
