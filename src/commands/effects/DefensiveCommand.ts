
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState, ActiveEffect } from '../../types/combat';
import { Spell } from '../../types/spells';

export class DefensiveCommand extends BaseEffectCommand {
  constructor(
    spell: Spell,
    casterId: string,
    targetIds: string[],
    private duration: number,
    private acBonus: number,
    private reactionTrigger?: "on_hit" | "on_damaged"
  ) {
    super(spell, casterId, targetIds);
  }

  execute(state: CombatState): CombatState {
    const newState = { ...state };

    // Defensive spells are almost always self-targeting (Shield, Mage Armor)
    // but we support target arrays for flexibility (Shield of Faith)
    this.targetIds.forEach(targetId => {
      const targetIndex = newState.characters.findIndex(c => c.id === targetId);
      if (targetIndex === -1) return;

      const target = newState.characters[targetIndex];

      // Create the active effect object
      const effect: ActiveEffect = {
        id: `effect-${this.spell.id}-${Date.now()}`,
        spellId: this.spell.id,
        casterId: this.casterId,
        sourceName: this.spell.name,
        type: 'buff', // Defensive spells are buffs
        duration: { type: 'rounds', value: this.duration },
        startTime: newState.turnState.currentTurn,
        mechanics: {
          acBonus: this.acBonus,
          triggerCondition: this.reactionTrigger
        }
      };

      // Add to character's active effects
      const activeEffects = target.activeEffects || [];
      newState.characters[targetIndex] = {
        ...target,
        activeEffects: [...activeEffects, effect],
        // Immediate AC update is handled by Derived Stats, but we can set a flag or
        // let the UI/Combat system recalculate AC based on activeEffects.
        // For optimization, we might update a cached value here if needed.
      };

      this.logEffectApplication(newState, targetId, `${this.spell.name} increases AC by ${this.acBonus}`);
    });

    return newState;
  }
}
