// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/06/2026, 10:54:35
 * Dependents: commands/effects/AttackRollModifierCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves damage applications on characters during combat.
 *
 * It is the core damage engine of the combat system. It handles applying damage numbers,
 * checking damage type resistances or vulnerabilities, rolling saving throws, running feat checks,
 * logging damage events, removing defeated summons, and prompting/checking spell concentration.
 *
 * Called by: useAbilitySystem.ts and various spell/ability command factories.
 * Depends on: deathSaveUtils for applying damage, resistanceUtils for resistances, and ConcentrationCommands to break spell maintenance.
 *
 * @file src/commands/effects/DamageCommand.ts
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState, CombatCharacter, StatusEffect, ActiveEffect } from '../../types/combat'
import { isDamageEffect } from '../../types/spells'
import { checkConcentration } from '../../utils/concentrationUtils';
import { calculateSpellDC, rollSavingThrow, calculateSaveDamage } from '../../utils/savingThrowUtils';
import type { SavingThrowModifier } from '../../utils/savingThrowUtils';
import { rollDamage as rollDamageUtil, calculateCover } from '../../utils/combatUtils';
import { BreakConcentrationCommand } from './ConcentrationCommands'
import { ResistanceCalculator } from '../../utils/combat/resistanceUtils';
import { getPlanarSpellModifier } from '../../utils/planarUtils';
import { StatusConditionCommand } from './StatusConditionCommand';
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem';
import { applyDamageAndCheckDowned } from '../../utils/combat/deathSaveUtils';
import { combatEvents } from '../../systems/events/CombatEvents';
import { getStateTagForDamageType } from '../../types/elemental';
import { applyStateToTags } from '../../systems/physics/ElementalInteractionSystem';

/** Unique key for tracking Slasher speed reduction once-per-turn usage */
const SLASHER_SLOW_USAGE_KEY = 'slasher_slow';

/**
 * Flavor verbs for combat log messages, keyed by damage type.
 * A random verb is selected when logging damage to add variety.
 */
const DAMAGE_VERBS: Record<string, string[]> = {
  acid: ['melts', 'corrodes', 'dissolves', 'burns'],
  bludgeoning: ['batters', 'crushes', 'pummels', 'bludgeons'],
  cold: ['freezes', 'chills', 'frosts', 'numbs'],
  fire: ['scorches', 'incinerates', 'burns', 'chars'],
  force: ['blasts', 'slams', 'impacts', 'strikes'],
  lightning: ['shocks', 'electrocutes', 'zaps', 'jolts'],
  necrotic: ['withers', 'decays', 'rots', 'drains'],
  piercing: ['impales', 'punctures', 'pierces', 'stabs'],
  poison: ['sickens', 'infects', 'poisons', 'taints'],
  psychic: ['shatters', 'stuns', 'assaults', 'confuses'],
  radiant: ['sears', 'blinds', 'burns', 'purifies'],
  slashing: ['slashes', 'cleaves', 'cuts', 'slices'],
  thunder: ['deafens', 'booms', 'blasts', 'shatters'],
};

/** Fallback verbs when damage type is unknown or not in DAMAGE_VERBS */
const DEFAULT_VERBS = ['damages', 'hits', 'strikes', 'hurts'];

/**
 * Command to apply damage to targets.
 * Handles damage calculation, HP reduction, and triggers concentration saves.
 */
export class DamageCommand extends BaseEffectCommand {
  async execute(state: CombatState): Promise<CombatState> {
    if (!isDamageEffect(this.effect)) {
      console.warn('DamageCommand received non-damage effect')
      return state
    }

    let currentState = state
    const caster = this.getCaster(currentState);

    // --- FEAT: Elemental Adept ---
    // If the caster has Elemental Adept for this damage type, treat 1s as 2s on damage dice.
    // This prevents low rolls from being wasted.
    let minRoll = 1;
    const elementalAdeptChoice = caster.featChoices?.['elemental_adept']?.selectedDamageType;
    if (elementalAdeptChoice && elementalAdeptChoice.toLowerCase() === this.effect.damage.type.toLowerCase()) {
      minRoll = 2;
    }

    // --- PLANAR MECHANICS ---
    // Some planes empower or impede certain spell schools.
    // Positive modifiers (+1 damage) are applied via upcasting in SpellCommandFactory.
    // Negative modifiers (impeded schools) are applied here to reduce damage.
    let planarModifier = 0;
    if (this.context.currentPlane && this.context.spellSchool) {
      planarModifier = getPlanarSpellModifier(this.context.spellSchool, this.context.currentPlane);
    }

    // --- MAIN DAMAGE LOOP: Process each target ---
    for (const target of this.getTargets(currentState)) {
      // Step 1: Roll base damage
      // - Parses dice string (e.g., "2d6+3") and rolls
      // - Doubles dice on critical hits
      // - Applies minRoll floor from Elemental Adept
      const isCritical = this.context.isCritical || false;
      this.emitSpellAttackHitEvent(caster, target, isCritical);
      let damageRoll = this.rollDamage(this.effect.damage.dice, isCritical, minRoll);

      // --- RACIAL TRAIT: Savage Attacks (Half-Orc) ---
      // If melee weapon attack and critical hit, roll one extra damage die
      // Following the 5e rules, Savage Attacks applies to a melee weapon attack.
      // We check if it is not ranged and has the savageAttacks modifier.
      if (
        isCritical &&
        caster.modifiers?.savageAttacks &&
        this.context.weaponProperties &&
        !this.context.weaponProperties.includes('ranged')
      ) {
        const dieSizeMatch = this.effect.damage.dice.match(/\b\d*d(\d+)\b/i);
        if (dieSizeMatch && dieSizeMatch[1]) {
          const dieSize = parseInt(dieSizeMatch[1], 10);
          const extraRoll = rollDamageUtil(`1d${dieSize}`, false, minRoll);
          damageRoll += extraRoll;
          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${caster.name}'s Savage Attacks adds +${extraRoll} (1d${dieSize}) to critical damage!`,
            characterId: caster.id
          });
        }
      }

      // Step 2: Apply planar impediment (negative modifier only)
      // Positive modifiers are handled upstream via upcasting.
      if (planarModifier < 0) {
        damageRoll += planarModifier; // Reduce damage
        damageRoll = Math.max(0, damageRoll); // Damage cannot go below 0
      }

      // --- GWM FEAT (2024): +Proficiency Bonus damage on every Heavy weapon hit ---
      // WHAT CHANGED: Added GWM damage bonus check.
      // WHY IT CHANGED: Following the 2024 PHB rules, GWM now adds a 
      // reliable flat bonus (Proficiency) instead of the old -5/+10 
      // mechanic. This is implemented here so it applies to any damage 
      // command tagged with 'heavy' weapon properties, ensuring consistency 
      // across all martial attacks.
      if (
        caster.feats?.includes('great_weapon_master') &&
        this.context.weaponProperties?.includes('heavy')
      ) {
        const gwmPB = Math.ceil((caster.level || 1) / 4) + 1;
        damageRoll += gwmPB;
      }

      // --- Step 3: Handle Saving Throw ---
      // If the effect requires a save (e.g., Dex save for Fireball), roll it here.
      // saveEffect determines damage on success: 'half' (most spells), 'none' (cantrips), or 'negates_condition'
      if (this.effect.condition.type === 'save' && this.effect.condition.saveType) {
        // Calculate the spell save DC: 8 + proficiency + spellcasting modifier
        let dc = calculateSpellDC(caster);

        // Impeded spell schools on certain planes reduce DC
        if (planarModifier < 0) {
          dc += planarModifier;
        }

        // Gather any active save penalties (e.g., Mind Sliver's -1d4)
        const savePenaltySystem = new SavePenaltySystem();
        const activeSaveModifiers = savePenaltySystem.getActivePenalties(target);

        // Dexterity saving throws can benefit from physical map cover, using the
        // same cover calculation that already protects attack rolls. This keeps
        // Fireball-style map positioning meaningful without changing non-Dex saves.
        const coverSaveModifier = this.getCoverSaveModifier(currentState, caster, target);
        const saveModifiers = coverSaveModifier
          ? [...activeSaveModifiers, coverSaveModifier]
          : activeSaveModifiers;

        // Roll the save: 1d20 + ability mod + proficiency (if proficient) + modifiers
        const saveResult = rollSavingThrow(target, this.effect.condition.saveType, dc, saveModifiers);

        // Adjust damage based on save outcome:
        // - Failed save: full damage
        // - Successful save with 'half': half damage (most leveled spells)
        // - Successful save with 'none': no damage reduction (rare)
        // - Successful save with 'negates_condition': 0 damage (cantrips)
        // NOTE: Default is 'half' which is WRONG for cantrips - spell data should specify 'none'
        damageRoll = calculateSaveDamage(
          damageRoll,
          saveResult,
          this.effect.condition.saveEffect || 'half'
        );

        // Consume one-time save penalties (e.g., Mind Sliver applies to "next save" only)
        currentState = savePenaltySystem.consumeNextSavePenalties(currentState, target.id);

        // Build and log the save outcome message
        let saveLogMessage = `${target.name} ${saveResult.success ? 'succeeds' : 'fails'} ${this.effect.condition.saveType} save (${saveResult.total} vs DC ${dc})`;

        // Append modifier details if any were applied (e.g., "-3 [Mind Sliver]")
        if (saveResult.modifiersApplied && saveResult.modifiersApplied.length > 0) {
          const modDetails = saveResult.modifiersApplied.map(m => `${m.value >= 0 ? '+' : ''}${m.value} [${m.source}]`).join(', ');
          saveLogMessage += ` (Mods: ${modDetails})`;
        }

        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: saveLogMessage,
          characterId: target.id
        });
      }

      // --- Step 4: Apply Resistances and Vulnerabilities ---
      // Reduces damage by half if resistant, doubles if vulnerable, or 0 if immune.
      // Also checks for bypasses (e.g., magical weapons bypassing non-magical resistance).
      let finalDamage = ResistanceCalculator.applyResistances(
        damageRoll,
        this.effect.damage.type,
        target,
        caster,
        this.context.isMagical,
        {
          spellZones: state.spellZones,
          characters: state.characters
        }
      );

      // --- HAM FEAT (2024): Reduce nonmagical physical damage by Proficiency Bonus ---
      // WHAT CHANGED: Added HAM damage reduction check.
      // WHY IT CHANGED: To support 2024 tanking mechanics. HAM now scales 
      // with Proficiency Bonus. By placing this check after standard 
      // resistances, we ensure the flat reduction applies to the final 
      // calculated damage, making it a powerful tool for heavily armored 
      // survivors.
      // TODO(FEATURES): Also gate on target wearing Heavy Armor once armor-type tracking exists.
      const physicalDamageTypes = ['bludgeoning', 'piercing', 'slashing', 'physical'];
      if (
        target.feats?.includes('heavy_armor_master') &&
        physicalDamageTypes.includes(this.effect.damage.type.toLowerCase()) &&
        this.context.weaponProperties !== undefined
      ) {
        const hamPB = Math.ceil((target.level || 1) / 4) + 1;
        finalDamage = Math.max(0, finalDamage - hamPB);
      }

      // --- RACIAL REACTIONS (e.g. Stone's Endurance) ---
      if (this.context.requestReaction && target.modifiers?.reactions && finalDamage > 0) {
        const validReactions = target.modifiers.reactions.filter(r => r.trigger?.type === 'on_target_takes_damage');
        if (validReactions.length > 0) {
          // Map to mock Spells so the UI can render them
          const reactionSpells = validReactions.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            level: 0,
            school: 'Abjuration',
            classes: [],
            subClasses: [],
            castingTime: { type: 'reaction' },
            components: { v: false, s: false, m: false },
            duration: { type: 'instantaneous' },
            targeting: { type: 'self' },
            effects: [ r.effect ]
          })) as any as import('../../types/spells').Spell[];

          const choice = await this.context.requestReaction(caster.id, target.id, 'on_take_damage', reactionSpells);
          if (choice) {
            const chosenReaction = validReactions.find(r => r.id === choice);
            if (chosenReaction) {
              if (chosenReaction.effect?.type === 'DEFENSIVE' && chosenReaction.effect.defenseType === 'damage_reduction') {
                const damageReduction = chosenReaction.effect.damageReduction;
                if (!damageReduction) continue;
                const dice = damageReduction.dice || '1d12';
                const drRoll = rollDamageUtil(dice, false, 1);
                let modifier = 0;
                if (damageReduction.abilityModifier === 'Constitution') {
                  modifier = Math.floor((target.stats.constitution - 10) / 2);
                }
                if (damageReduction.addProficiencyBonus) {
                  modifier += Math.ceil((target.level || 1) / 4) + 1;
                }
                const totalReduction = drRoll + modifier;
                finalDamage = Math.max(0, finalDamage - totalReduction);

                currentState = this.addLogEntry(currentState, {
                  type: 'status',
                  message: `${target.name} uses ${chosenReaction.name} and reduces damage by ${totalReduction} (${dice} + ${modifier})!`,
                  characterId: target.id
                });
              } else if (chosenReaction.effect?.type === 'DAMAGE') {
                const rdDice = chosenReaction.effect.damage.dice;
                const rdRoll = rollDamageUtil(rdDice, false, 1);
                const newCasterHP = Math.max(0, caster.currentHP - rdRoll);
                currentState = this.updateCharacter(currentState, caster.id, { currentHP: newCasterHP });
                currentState = this.addLogEntry(currentState, {
                  type: 'damage',
                  message: `${target.name} uses ${chosenReaction.name} to deal ${rdRoll} ${chosenReaction.effect.damage.type} damage to ${caster.name}!`,
                  characterId: caster.id
                });
              } else if (chosenReaction.effect?.type === 'REACTIVE') {
                currentState = this.addLogEntry(currentState, {
                  type: 'status',
                  message: `${target.name} triggers ${chosenReaction.name} against ${caster.name}! (Counter-attack queued)`,
                  characterId: target.id
                });
              }
            }
          }
        }
      }

      // --- Step 5: Apply final damage to target's HP ---
      // We delegate HP reduction, temporary HP, and downed/unconscious state changes
      // to the centralized applyDamageAndCheckDowned utility.
      const updatedTarget = applyDamageAndCheckDowned(target, finalDamage, isCritical);
      currentState = this.updateCharacter(currentState, target.id, {
        currentHP: updatedTarget.currentHP,
        tempHP: updatedTarget.tempHP,
        temporaryHitPointSource: updatedTarget.temporaryHitPointSource,
        deathSaves: updatedTarget.deathSaves,
        statusEffects: updatedTarget.statusEffects,
        conditions: updatedTarget.conditions,
        damagedThisTurn: updatedTarget.damagedThisTurn
      });

      // --- Step 5b: Apply elemental state transition ---
      // Elemental damage contacts the target and resolves against its existing
      // stateTags (e.g. Wet + Cold -> Frozen, Wet + Fire -> Smoke). This is the
      // command-level wiring from damage element into the physics state engine.
      currentState = this.applyElementalState(currentState, target);

      // --- SLASHER FEAT LOGIC ---
      if (caster.feats?.includes('slasher') && this.effect.damage.type.toLowerCase() === 'slashing' && finalDamage > 0) {
        currentState = this.applySlasherFeat(currentState, caster, target, isCritical);
      }

      // --- LOGGING ---
      currentState = this.logDamage(currentState, caster, target, finalDamage, planarModifier);

      // --- Step 6: Check Concentration ---
      // If the target is concentrating on a spell and took damage,
      // they must make a Constitution save (DC = 10 or half damage, whichever is higher).
      // If the damage drops them to 0 HP (downed/unconscious), they automatically fail and drop concentration immediately.
      // Failure breaks concentration and ends their maintained spell.
      if (target.concentratingOn && damageRoll > 0) {
        if (updatedTarget.currentHP === 0) {
          // Downed characters automatically lose concentration without rolling.
          const breakCommand = new BreakConcentrationCommand({
            ...this.context,
            caster: target,
            spellId: target.concentratingOn.spellId,
            spellName: target.concentratingOn.spellName,
            targets: []
          });

          currentState = await breakCommand.execute(currentState);

          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${target.name} falls unconscious and automatically loses concentration on ${target.concentratingOn.spellName}`,
            characterId: target.id
          });
        } else {
          const check = checkConcentration(target, damageRoll);

          if (!check.success) {
            // Concentration broken - execute command to clean up the spell's effects
            const breakCommand = new BreakConcentrationCommand({
              ...this.context,
              caster: target,
              spellId: target.concentratingOn.spellId,
              spellName: target.concentratingOn.spellName,
              targets: []
            });

            currentState = await breakCommand.execute(currentState);

            currentState = this.addLogEntry(currentState, {
              type: 'status',
              message: `${target.name} fails concentration save (${check.roll} vs DC ${check.dc})`,
              characterId: target.id
            });
          } else {
            // Concentration maintained
            currentState = this.addLogEntry(currentState, {
              type: 'status',
              message: `${target.name} maintains concentration (${check.roll} vs DC ${check.dc})`,
              characterId: target.id
            });
          }
        }
      }

      // Summoned creatures are temporary spell-created map actors, not normal
      // dying combatants. When damage drops one to 0 HP, remove it from the
      // combat roster so familiar and summon disappearance rules have a real
      // runtime foothold instead of leaving an inert token on the map.
      if (target.isSummon && updatedTarget.currentHP <= 0) {
        currentState = this.removeDefeatedSummon(currentState, target);
      }
    }

    return currentState
  }

  get description(): string {
    if (isDamageEffect(this.effect)) {
      return `Deals ${this.effect.damage.dice} ${this.effect.damage.type} damage`
    }
    return 'Deals damage'
  }

  /**
   * Applies the effects of the Slasher feat:
   * 1. Reduce speed by 10ft (at most once per turn).
   * 2. On critical hit, target has disadvantage on attacks until start of attacker's next turn.
   */
  private applySlasherFeat(
    state: CombatState,
    caster: CombatState['characters'][0],
    target: CombatState['characters'][0],
    isCritical: boolean
  ): CombatState {
    let currentState = state;

    // Rule 1: Reduce Speed by 10ft (Once per turn)
    // Check if we've already used Slasher slow this turn
    const hasUsedSlasherSlowThisTurn = caster.featUsageThisTurn?.includes(SLASHER_SLOW_USAGE_KEY);

    if (!hasUsedSlasherSlowThisTurn) {
      // Mark Slasher slow as used for this turn on the caster
      const updatedFeatUsage = [...(caster.featUsageThisTurn || []), SLASHER_SLOW_USAGE_KEY];
      currentState = this.updateCharacter(currentState, caster.id, {
        featUsageThisTurn: updatedFeatUsage
      });

      // Apply speed reduction status effect
      const slasherSlow: StatusEffect = {
        id: `slasher_slow_${target.id}_${currentState.turnState.currentTurn}`,
        name: 'Slasher Slow',
        type: 'debuff',
        duration: 1, // Until start of attacker's next turn (1 round)
        effect: {
          type: 'stat_modifier',
          stat: 'speed',
          value: -10
        },
        icon: '🦶'
      };

      const slowCommand = new StatusConditionCommand(
        {
          type: 'STATUS_CONDITION',
          trigger: { type: 'immediate' },
          condition: { type: 'hit' },
          statusCondition: {
            name: 'Slasher Slow',
            duration: { type: 'rounds', value: 1 },
            effect: slasherSlow.effect
          }
        },
        {
          ...this.context,
          targets: [target]
        }
      );
      currentState = slowCommand.execute(currentState);

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `${caster.name}'s Slasher feat slows ${target.name} by 10ft!`,
        characterId: target.id
      });
    }

    // Rule 2: Critical Hit -> Disadvantage on attacks until attacker's next turn
    if (isCritical) {
      const grievousWound: ActiveEffect = {
        id: `slasher_grievous_${target.id}_${currentState.turnState.currentTurn}`,
        spellId: 'slasher',
        casterId: caster.id,
        sourceName: 'Slasher Grievous Wound',
        type: 'debuff',
        duration: { type: 'rounds', value: 1 },
        startTime: currentState.turnState.currentTurn,
        mechanics: {
          disadvantageOnAttacks: true
        }
      };

      // Get the latest target state to avoid stale references
      const currentTarget = currentState.characters.find(c => c.id === target.id);
      const updatedActiveEffects = [...(currentTarget?.activeEffects || []), grievousWound];

      currentState = this.updateCharacter(currentState, target.id, {
        activeEffects: updatedActiveEffects
      });

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `CRITICAL HIT! ${caster.name}'s Slasher feat grievously wounds ${target.name} (Disadvantage on attacks)!`,
        characterId: target.id
      });
    }

    return currentState;
  }

  /**
   * Maps the damage element to an elemental StateTag and resolves it against the
   * target's existing `stateTags` via the physics interaction engine.
   *
   * Damage types without an elemental meaning (bludgeoning, force, psychic, etc.)
   * map to nothing and leave state untouched. When a reaction occurs (e.g. a Wet
   * target struck by Cold becomes Frozen), the resolved interaction is logged so
   * the combat log surfaces the physics outcome.
   */
  private applyElementalState(
    state: CombatState,
    target: CombatCharacter
  ): CombatState {
    if (!isDamageEffect(this.effect)) return state;

    const incomingState = getStateTagForDamageType(this.effect.damage.type);
    if (!incomingState) return state;

    // Use the freshest target snapshot so this runs after the HP/status update.
    const currentTarget = state.characters.find(c => c.id === target.id);
    if (!currentTarget) return state;

    const { newStates, result } = applyStateToTags(currentTarget.stateTags || [], incomingState);

    let nextState = this.updateCharacter(state, target.id, { stateTags: newStates });

    const message = result.interaction
      ? `${currentTarget.name}: ${result.interaction}`
      : `${currentTarget.name} is now ${incomingState}`;

    nextState = this.addLogEntry(nextState, {
      type: 'status',
      message,
      characterId: target.id,
      targetIds: [target.id],
      data: { stateTags: newStates }
    });

    return nextState;
  }

  private logDamage(
    state: CombatState,
    caster: CombatState['characters'][0],
    target: CombatState['characters'][0],
    finalDamage: number,
    planarModifier: number
  ): CombatState {
    if (!isDamageEffect(this.effect)) return state;

    const damageType = this.effect.damage.type.toLowerCase();
    const verbs = DAMAGE_VERBS[damageType] || DEFAULT_VERBS;
    const verbIndex = Math.floor(Math.random() * verbs.length);
    const verb = verbs[verbIndex];

    const sourceName = this.context.spellName;
    let logMessage = '';

    if (sourceName && sourceName !== 'Attack') {
      logMessage = `${caster.name} ${verb} ${target.name} with ${sourceName} for ${finalDamage} ${damageType} damage`;
      if (planarModifier !== 0) {
        logMessage += ` (Planar Boost: ${planarModifier > 0 ? '+' : ''}${planarModifier})`;
      }
    } else {
      logMessage = `${caster.name} ${verb} ${target.name} for ${finalDamage} ${damageType} damage`;
    }

    return this.addLogEntry(state, {
      type: 'damage',
      message: logMessage,
      characterId: target.id,
      targetIds: [target.id],
      data: { value: finalDamage, type: this.effect.damage.type }
    });
  }

  /**
   * Removes a spell-created summon after it reaches 0 HP.
   *
   * Ordinary player and monster combatants remain in the roster so the death-save
   * and unconscious systems can handle them. Summons are different: familiar and
   * summon spell text usually says the created creature disappears at 0 HP, and
   * the map needs that cleanup immediately so 2D/3D tokens do not linger.
   */
  private removeDefeatedSummon(
    state: CombatState,
    target: CombatState['characters'][0]
  ): CombatState {
    const remainingCharacters = state.characters.filter(character => character.id !== target.id);
    const summonLabel = target.summonMetadata?.formName ?? target.summonMetadata?.entityType ?? target.name;
    const sourceLabel = target.summonMetadata?.sourceName
      ? ` from ${target.summonMetadata.sourceName}`
      : '';

    return this.addLogEntry({
      ...state,
      characters: remainingCharacters
    }, {
      type: 'status',
      message: `${target.name} (${summonLabel}${sourceLabel}) disappears as the spell-created summon drops to 0 HP`,
      characterId: target.summonMetadata?.casterId ?? target.id,
      targetIds: [target.id],
      data: {
        removedSummonId: target.id,
        spellId: target.summonMetadata?.spellId,
        entityType: target.summonMetadata?.entityType,
        formName: target.summonMetadata?.formName,
        sourceName: target.summonMetadata?.sourceName
      }
    });
  }

  /**
   * Helper to parse dice string (e.g., "2d6+3") and roll damage.
   * Delegates to centralized combatUtils for consistent critical hit logic.
   */
  private rollDamage(diceString: string, isCritical: boolean, minRoll: number = 1): number {
    return rollDamageUtil(diceString, isCritical, minRoll);
  }

  /**
   * Publishes the structured attack fact for spell attacks that already reached
   * a hit-conditioned damage row.
   *
   * Weapon attacks emit their own hit/miss event at the attack-roll command.
   * Spell attack rolls do not have an equivalent command yet, so this bridge
   * records only confirmed spell hits without inventing miss rolls or changing
   * the damage model.
   */
  private emitSpellAttackHitEvent(
    caster: CombatCharacter,
    target: CombatCharacter,
    isCritical: boolean
  ): void {
    // Only spell damage rows with a melee/ranged spell attack marker should
    // produce spell attack events. Save-based area damage and weapon-backed
    // damage commands already have different trigger semantics.
    if (
      this.effect.condition.type !== 'hit' ||
      !['melee', 'ranged'].includes(this.context.attackType ?? '') ||
      this.context.weaponProperties !== undefined
    ) {
      return;
    }

    // Emit the same event shape as weapon attacks so reactive consumers can
    // enforce hit-only and melee/ranged filters without reading combat-log text.
    combatEvents.emit({
      type: 'unit_attack',
      attackerId: caster.id,
      targetId: target.id,
      isHit: true,
      isCrit: isCritical,
      attackType: 'spell',
      weaponType: this.context.attackType
    });
  }

  /**
   * Builds the saving-throw modifier granted by map cover.
   *
   * Cover only affects Dexterity saves in the 5e rules this command is modeling.
   * The map already knows how to calculate half-cover and three-quarters-cover
   * bonuses for attacks, so this helper reuses that signal for spell saves.
   *
   * TODO(next-agent): Total cover is not represented by `calculateCover` yet.
   * When total-cover geometry exists, route it through this helper instead of
   * treating it as another flat bonus.
   */
  private getCoverSaveModifier(
    state: CombatState,
    caster: CombatState['characters'][0],
    target: CombatState['characters'][0]
  ): SavingThrowModifier | undefined {
    // Non-Dexterity saves do not receive cover bonuses from battlefield geometry.
    if (!isDamageEffect(this.effect) || this.effect.condition.saveType !== 'Dexterity') {
      return undefined;
    }

    // Mapless combat has no cover geometry to inspect, so the save proceeds normally.
    if (!state.mapData) {
      return undefined;
    }

    // Use the same origin-to-target cover calculation as attack resolution.
    const coverBonus = calculateCover(caster.position, target.position, state.mapData);
    const coverGrade = this.getCoverGrade(coverBonus);

    // No cover grade means no saving-throw modifier is needed.
    if (!coverGrade || coverBonus <= 0) {
      return undefined;
    }

    // Some spells explicitly bypass normal cover. Sacred Flame is the canonical
    // example: it ignores half and three-quarters cover but should not silently
    // erase future total-cover rules.
    if (this.isCoverBypassed(coverGrade)) {
      return undefined;
    }

    return {
      flat: coverBonus,
      source: 'Cover'
    };
  }

  /**
   * Converts the numeric cover bonus into the spell-data vocabulary.
   *
   * This bridge lets JSON metadata such as `ignoredCover: ["half"]` compare
   * against the existing combat utility without inventing a second cover model.
   */
  private getCoverGrade(coverBonus: number): 'half' | 'three_quarters' | undefined {
    if (coverBonus >= 5) {
      return 'three_quarters';
    }

    if (coverBonus >= 2) {
      return 'half';
    }

    return undefined;
  }

  /**
   * Checks whether this spell says to ignore the current cover grade.
   *
   * The modifier lives on effect condition metadata because it changes how the
   * saving throw is made, not how much damage the spell rolls afterward.
   */
  private isCoverBypassed(coverGrade: 'half' | 'three_quarters'): boolean {
    const saveModifiers = this.effect.condition.saveModifiers || [];

    return saveModifiers.some(modifier =>
      modifier.type === 'cover_bypass' &&
      modifier.ignoredCover?.includes(coverGrade)
    );
  }
}
