// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 10/07/2026, 13:59:46
 * Dependents: commands/effects/AttackRollModifierCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 15 files
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
import { CombatState, CombatCharacter, StatusEffect, ActiveEffect, ActiveEnvironmentalControl, ActiveSpellEmanation, ActiveSpellGuardian, Position, SelectedSpellTarget } from '../../types/combat'
import { isDamageEffect } from '../../types/spells'
import type { DamageEffect } from '../../types/spells'
import { checkConcentration } from '../../utils/concentrationUtils';
import { calculateSpellDC, rollSavingThrow, calculateSaveDamage } from '../../utils/savingThrowUtils';
import type { SavingThrowModifier } from '../../utils/savingThrowUtils';
import { rollDamage as rollDamageUtil, calculateCover, generateId } from '../../utils/combatUtils';
import { BreakConcentrationCommand, breakFriendsConcentrationForCaster } from './ConcentrationCommands'
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

    if (this.context.spellId === 'guardian-of-faith' && this.effect.trigger?.type === 'on_enter_area') {
      currentState = this.applyGuardianOfFaithState(currentState, caster);
    }

    if (this.context.spellId === 'mordenkainens-faithful-hound') {
      currentState = this.applyFaithfulHoundState(currentState, caster);
    }

    if (this.context.spellId === 'conjure-elemental' && this.effect.controlledEntity?.entityType === 'elemental_spirit_eruption') {
      currentState = this.applyConjureElementalState(currentState, caster);
    }

    // Conjure Minor Elementals and Conjure Woodland Beings are shaped
    // caster-following emanations. Keep them as explicit area records so the
    // later terrain and bonus-action rows can enrich the same runtime object.
    const controlledEntityType = (this.effect.controlledEntity as { entityType?: string } | undefined)?.entityType;

    if (this.context.spellId === 'conjure-minor-elementals' && controlledEntityType === 'elemental_spirit_emanation') {
      currentState = this.applyConjureMinorElementalsState(currentState, caster);
    }

    if (this.context.spellId === 'conjure-woodland-beings' && controlledEntityType === 'nature_spirit_emanation') {
      currentState = this.applyConjureWoodlandBeingsState(currentState, caster);
    }

    // Wrath of Nature creates a controlled terrain volume before any creature
    // is selected for the recurring tree, root, or rock branches.
    if (this.context.spellId === 'wrath-of-nature' && controlledEntityType === 'animated_nature_area') {
      currentState = this.applyWrathOfNatureEnvironmentalControl(currentState, caster);
    }

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
      const damageDice = this.resolveHitPointStateDamageDice(target);
      let damageRoll = this.rollDamage(damageDice, isCritical, minRoll);

      // Some spell payloads deliberately resolve as a fraction of the rolled
      // damage before any mitigation is applied. Lightning Arrow's missed
      // attack rider is the first shared runtime use: it rolls the normal
      // primary damage, halves that roll, then still needs the standard
      // resistance, immunity, temporary HP, death-save, elemental-state, and
      // concentration handling below.
      if (typeof this.context.damageMultiplier === 'number') {
        damageRoll = Math.max(0, Math.floor(damageRoll * this.context.damageMultiplier));
      }

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

      // Resistance is a separate flat rider from the normal resistance math.
      // It spends once per turn on the first qualifying hit of the chosen type
      // and leaves every other damage type untouched.
      const resistanceRiderResult = this.applyResistanceRider(currentState, target, finalDamage);
      currentState = resistanceRiderResult.state;
      finalDamage = resistanceRiderResult.damage;
      const targetAfterResistance = currentState.characters.find(character => character.id === target.id) ?? target;

      // --- HAM FEAT (2024): Reduce nonmagical physical damage by Proficiency Bonus ---
      // WHAT CHANGED: Added HAM damage reduction check.
      // WHY IT CHANGED: To support 2024 tanking mechanics. HAM now scales 
      // with Proficiency Bonus. By placing this check after standard 
      // resistances, we ensure the flat reduction applies to the final 
      // calculated damage, making it a powerful tool for heavily armored 
      // survivors.
      // TODO #5(FEATURES): Also gate on target wearing Heavy Armor once armor-type tracking exists.
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
      const updatedTarget = applyDamageAndCheckDowned(targetAfterResistance, finalDamage, isCritical);
      currentState = this.updateCharacter(currentState, target.id, {
        currentHP: updatedTarget.currentHP,
        tempHP: updatedTarget.tempHP,
        temporaryHitPointSource: updatedTarget.temporaryHitPointSource,
        deathSaves: updatedTarget.deathSaves,
        statusEffects: updatedTarget.statusEffects,
        conditions: updatedTarget.conditions,
        damagedThisTurn: updatedTarget.damagedThisTurn
      });

      // --- Step 5a: Dark One's Blessing (Fiend warlock, level 3) ---
      // When the caster carries Dark One's Blessing and this damage just dropped
      // a non-summon creature from positive HP to 0, the caster gains temporary
      // hit points. This is the faithful trigger point: the exact moment a target
      // is reduced to 0 HP by the caster's damage.
      if (
        caster.darkOnesBlessingTempHp &&
        caster.id !== target.id &&
        targetAfterResistance.currentHP > 0 &&
        updatedTarget.currentHP === 0 &&
        !target.isSummon
      ) {
        currentState = this.applyDarkOnesBlessing(currentState, caster);
      }

      // --- Step 5b: Apply elemental state transition ---
      // Elemental damage contacts the target and resolves against its existing
      // stateTags (e.g. Wet + Cold -> Frozen, Wet + Fire -> Smoke). This is the
      // command-level wiring from damage element into the physics state engine.
      currentState = this.applyElementalState(currentState, target);

      // --- SLASHER FEAT LOGIC ---
      if (caster.feats?.includes('slasher') && this.effect.damage.type.toLowerCase() === 'slashing' && finalDamage > 0) {
        // Slasher delegates its slow to the same asynchronous condition command
        // used by spells. Wait for that completed state before logging damage or
        // resolving concentration so later steps never receive a pending Promise.
        currentState = await this.applySlasherFeat(currentState, caster, target, isCritical);
      }

      // --- LOGGING ---
      currentState = this.logDamage(currentState, caster, target, finalDamage, planarModifier);

      // Negative Energy Flood has a delayed death animation instead of an
      // immediate summon. When its damage actually kills a non-Undead target,
      // attach the pending Zombie rise to the caster so the next-turn bridge
      // can resolve it from structured state.
      if (this.shouldRecordNegativeEnergyFloodRise(target, updatedTarget, finalDamage)) {
        currentState = this.recordNegativeEnergyFloodRise(currentState, caster, target);
      }

      if (finalDamage > 0) {
        currentState = await breakFriendsConcentrationForCaster(
          currentState,
          caster,
          this.context,
          'caster_deals_damage',
          target.name
        );
      }

      currentState = await this.breakFriendsWhenTargetTakesDamage(currentState, updatedTarget, finalDamage);

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

  private shouldRecordNegativeEnergyFloodRise(
    originalTarget: CombatCharacter,
    updatedTarget: CombatCharacter,
    finalDamage: number
  ): boolean {
    if (this.context.spellId !== 'negative-energy-flood' || finalDamage <= 0 || updatedTarget.currentHP > 0) {
      return false;
    }

    return !originalTarget.creatureTypes?.some(type => type.toLowerCase() === 'undead');
  }

  private recordNegativeEnergyFloodRise(
    state: CombatState,
    caster: CombatCharacter,
    target: CombatCharacter
  ): CombatState {
    const existingCaster = state.characters.find(character => character.id === caster.id) ?? caster;
    const deathAnimation = this.effect.deathAnimationState;
    const summonControl = this.effect.summonControl;
    const activeEffect: ActiveEffect = {
      id: `negative_energy_flood_zombie_rise_${generateId()}`,
      spellId: this.context.spellId || 'negative-energy-flood',
      casterId: caster.id,
      sourceName: this.context.spellName || 'Negative Energy Flood',
      type: 'utility',
      duration: {
        type: 'rounds',
        value: 1
      },
      startTime: state.turnState.currentTurn,
      mechanics: {
        negativeEnergyFloodZombieRise: {
          targetId: target.id,
          targetName: target.name,
          targetCreatureTypes: target.creatureTypes,
          position: target.position,
          entityType: summonControl?.entityType ?? 'zombie_from_killed_target',
          timing: deathAnimation?.timing ?? 'start_of_caster_next_turn',
          behavior: deathAnimation?.behavior ?? this.effect.aftermathState?.behavior,
          statBlock: deathAnimation?.statBlock ?? summonControl?.statBlock
        }
      }
    };

    const withoutPreviousRise = (existingCaster.activeEffects || []).filter(effect =>
      effect.mechanics?.negativeEnergyFloodZombieRise?.targetId !== target.id
    );
    const withPendingRise = this.updateCharacter(state, caster.id, {
      activeEffects: [
        ...withoutPreviousRise,
        activeEffect
      ]
    });

    return this.addLogEntry(withPendingRise, {
      type: 'status',
      message: `${target.name} is marked to rise as a Zombie at the start of ${caster.name}'s next turn.`,
      characterId: caster.id,
      targetIds: [target.id],
      data: {
        spellId: this.context.spellId,
        pendingAftermath: 'negative_energy_flood_zombie_rise',
        pendingRise: activeEffect.mechanics?.negativeEnergyFloodZombieRise
      }
    });
  }

  private applyGuardianOfFaithState(state: CombatState, caster: CombatCharacter): CombatState {
    const position = this.resolvePointTarget() ?? caster.position;
    const existingGuardians = state.activeSpellGuardians || [];
    const retainedGuardians = existingGuardians.filter(guardian =>
      guardian.spellId !== this.context.spellId ||
      guardian.casterId !== caster.id
    );
    const guardian: ActiveSpellGuardian = {
      id: `spell_guardian_guardian_of_faith_${generateId()}`,
      spellId: this.context.spellId || 'guardian-of-faith',
      spellName: this.context.spellName,
      casterId: caster.id,
      kind: 'guardian_of_faith',
      position,
      size: 'Large',
      occupiesSpace: true,
      invulnerable: true,
      threatRadiusFeet: 10,
      active: true,
      createdTurn: state.turnState.currentTurn,
      expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
      triggerPolicy: {
        targets: 'enemy_creatures',
        onEnterFrequency: this.effect.trigger?.frequency,
        turnStartTrigger: true,
        saveAbility: this.effect.condition.saveType,
        saveOutcome: this.effect.condition.saveEffect,
        damageAmount: Number(this.effect.damage.dice) || 20,
        damageType: this.effect.damage.type
      },
      damageCap: {
        maxTotalDamage: 60,
        dealtDamage: 0,
        vanishWhenReached: true
      }
    };

    return this.addLogEntry({
      ...state,
      activeSpellGuardians: [...retainedGuardians, guardian]
    }, {
      type: 'summon',
      message: `${this.context.spellName || 'Guardian of Faith'} appears at the chosen point.`,
      characterId: caster.id,
      data: {
        spellGuardianSurface: 'guardian_of_faith',
        spellGuardian: guardian,
        removedRecastGuardians: existingGuardians.length - retainedGuardians.length
      }
    });
  }

  private applyFaithfulHoundState(state: CombatState, caster: CombatCharacter): CombatState {
    const position = this.resolvePointTarget() ?? caster.position;
    const existingGuardians = state.activeSpellGuardians || [];
    const retainedGuardians = existingGuardians.filter(guardian =>
      guardian.spellId !== this.context.spellId ||
      guardian.casterId !== caster.id
    );
    const guardianObject = this.effect.createdObjects?.find(object => object.objectType === 'spectral_guardian');
    const separationEnding = this.effect.conditionalEndings?.find(ending => ending.trigger === 'beyond_max_distance');
    const guardian: ActiveSpellGuardian = {
      id: `spell_guardian_faithful_hound_${generateId()}`,
      spellId: this.context.spellId || 'mordenkainens-faithful-hound',
      spellName: this.context.spellName,
      casterId: caster.id,
      kind: 'faithful_hound',
      position,
      size: 'Medium',
      occupiesSpace: false,
      invulnerable: guardianObject?.invulnerable ?? true,
      threatRadiusFeet: 5,
      active: true,
      createdTurn: state.turnState.currentTurn,
      expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
      triggerPolicy: {
        targets: 'enemy_creatures',
        onEnterTrigger: false,
        turnStartTrigger: true,
        saveAbility: this.effect.condition.saveType,
        saveOutcome: this.effect.condition.saveEffect,
        damageAmount: this.getDamageDiceCount(this.effect.damage.dice),
        damageDice: this.effect.damage.dice,
        damageType: this.effect.damage.type
      },
      damageCap: {
        maxTotalDamage: Number.POSITIVE_INFINITY,
        dealtDamage: 0,
        vanishWhenReached: false
      },
      watchdog: {
        visibleTo: this.normalizeFaithfulHoundVisibility(this.effect.visionLightSound?.houndVisibility),
        intangible: guardianObject?.intangible ?? this.effect.visionLightSound?.houndPhysicality?.includes('intangible') ?? true,
        truesightFeet: this.effect.visionLightSound?.truesightFeet,
        barkingAlarmRadiusFeet: 30,
        barkTrigger: this.effect.visionLightSound?.barkTrigger ?? this.effect.communicationDetails?.trigger,
        password: this.extractKeyedPlayerInput('password'),
        passwordPreventsBark: this.effect.visionLightSound?.passwordPreventsBark ?? this.effect.communicationDetails?.passwordSpecifiedAtCast
      },
      movement: {
        action: 'Magic action',
        maxDistanceFeet: 30
      },
      separationEnding: {
        trigger: separationEnding?.trigger,
        scope: separationEnding?.scope,
        maxDistanceFeet: separationEnding?.distanceFeet
      }
    };

    return this.addLogEntry({
      ...state,
      activeSpellGuardians: [...retainedGuardians, guardian]
    }, {
      type: 'summon',
      message: `${this.context.spellName || "Mordenkainen's Faithful Hound"} appears at the chosen point.`,
      characterId: caster.id,
      data: {
        spellGuardianSurface: 'faithful_hound',
        spellGuardian: guardian,
        removedRecastGuardians: existingGuardians.length - retainedGuardians.length
      }
    });
  }

  private applyConjureElementalState(state: CombatState, caster: CombatCharacter): CombatState {
    const position = this.resolvePointTarget() ?? caster.position;
    const existingGuardians = state.activeSpellGuardians || [];
    const retainedGuardians = existingGuardians.filter(guardian =>
      guardian.spellId !== this.context.spellId ||
      guardian.casterId !== caster.id
    );
    const element = this.resolveConjureElementalChoice();
    const damageType = this.resolveConjureElementalDamageType(element);
    const repeatDamage = this.effect.recurringMechanics?.find(mechanic => mechanic.timing === 'turn_start')?.damage;
    const guardian: ActiveSpellGuardian = {
      id: `spell_guardian_conjure_elemental_${generateId()}`,
      spellId: this.context.spellId || 'conjure-elemental',
      spellName: this.context.spellName,
      casterId: caster.id,
      kind: 'conjure_elemental',
      position,
      size: 'Large',
      occupiesSpace: false,
      invulnerable: true,
      threatRadiusFeet: 5,
      active: true,
      createdTurn: state.turnState.currentTurn,
      expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
      triggerPolicy: {
        targets: 'visible_creatures',
        onEnterTrigger: true,
        onEnterFrequency: this.effect.trigger?.frequency,
        turnStartTrigger: true,
        saveAbility: this.effect.condition.saveType,
        saveOutcome: this.effect.condition.saveEffect,
        damageAmount: this.getDamageDiceCount(this.effect.damage.dice),
        damageDice: this.effect.damage.dice,
        damageType
      },
      damageCap: {
        maxTotalDamage: Number.POSITIVE_INFINITY,
        dealtDamage: 0,
        vanishWhenReached: false
      },
      elementalSpirit: {
        origin: this.effect.controlledEntity.origin,
        element,
        damageType,
        initialDamageDice: this.effect.damage.dice,
        repeatDamageDice: repeatDamage?.dice,
        intangible: true,
        restrainedTargetId: undefined
      }
    };

    return this.addLogEntry({
      ...state,
      activeSpellGuardians: [...retainedGuardians, guardian]
    }, {
      type: 'summon',
      message: `${this.context.spellName || 'Conjure Elemental'} creates a ${element} spirit at the chosen point.`,
      characterId: caster.id,
      data: {
        spellGuardianSurface: 'conjure_elemental',
        spellGuardian: guardian,
        removedRecastGuardians: existingGuardians.length - retainedGuardians.length
      }
    });
  }

  private applyConjureMinorElementalsState(state: CombatState, caster: CombatCharacter): CombatState {
    const existingEmanations = state.activeSpellEmanations || [];
    const retainedEmanations = existingEmanations.filter(emanation =>
      emanation.spellId !== this.context.spellId ||
      emanation.casterId !== caster.id
    );
    const createdObject = this.effect.createdObjects?.[0] as {
      difficultTerrainAppliesTo?: string;
      createsDifficultTerrain?: boolean;
    } | undefined;
    const damageRider = {
      trigger: 'on_attack_hit' as const,
      dice: this.effect.damage.dice,
      damageTypeChoices: ['Acid', 'Cold', 'Fire', 'Lightning'],
      chosenDamageType: this.resolveConjureMinorElementalsDamageType(),
      slotScaling: this.effect.scaling?.bonusPerLevel
    };
    const terrain = {
      terrainType: 'difficult' as const,
      appliesTo: createdObject?.difficultTerrainAppliesTo ?? 'caster_enemies',
      followsCaster: true,
      createsDifficultTerrain: createdObject?.createsDifficultTerrain ?? true
    };
    const existingEmanation = existingEmanations.find(emanation =>
      emanation.spellId === this.context.spellId &&
      emanation.casterId === caster.id
    );
    const emanation: ActiveSpellEmanation = {
      id: existingEmanation?.id ?? `spell_emanation_${this.context.spellId || 'conjure-minor-elementals'}_${caster.id}`,
      spellId: this.context.spellId || 'conjure-minor-elementals',
      spellName: this.context.spellName,
      casterId: caster.id,
      kind: 'elemental_spirit_emanation',
      entityType: 'elemental_spirit_emanation',
      radiusFeet: 15,
      combatEntity: false,
      followsCaster: true,
      active: true,
      createdTurn: state.turnState.currentTurn,
      expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
      damageRider,
      terrain: existingEmanation?.terrain ?? terrain
    };

    return {
      ...state,
      activeSpellEmanations: [...retainedEmanations, {
        ...existingEmanation,
        ...emanation
      }]
    };
  }

  private applyConjureWoodlandBeingsState(state: CombatState, caster: CombatCharacter): CombatState {
    const existingEmanations = state.activeSpellEmanations || [];
    const retainedEmanations = existingEmanations.filter(emanation =>
      emanation.spellId !== this.context.spellId ||
      emanation.casterId !== caster.id
    );
    const existingEmanation = existingEmanations.find(emanation =>
      emanation.spellId === this.context.spellId &&
      emanation.casterId === caster.id
    );
    const emanation: ActiveSpellEmanation = {
      id: existingEmanation?.id ?? `spell_emanation_${this.context.spellId || 'conjure-woodland-beings'}_${caster.id}`,
      spellId: this.context.spellId || 'conjure-woodland-beings',
      spellName: this.context.spellName,
      casterId: caster.id,
      kind: 'nature_spirit_emanation',
      entityType: 'nature_spirit_emanation',
      radiusFeet: 10,
      combatEntity: false,
      followsCaster: true,
      active: true,
      createdTurn: state.turnState.currentTurn,
      expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
      damageAura: {
        trigger: 'emanation_entry_or_turn_end',
        dice: this.effect.damage.dice,
        damageType: this.effect.damage.type,
        saveAbility: this.effect.condition.saveType || 'Wisdom',
        saveOutcome: this.effect.condition.saveEffect || 'half',
        oncePerTurn: this.effect.trigger?.oncePerTurn === true,
        slotScaling: this.effect.scaling?.bonusPerLevel
      },
      grantedActions: this.effect.grantedActions?.length
        ? this.effect.grantedActions.map(action => ({
            type: action.type,
            action: action.action,
            frequency: action.frequency
          }))
        : existingEmanation?.grantedActions
    };

    return {
      ...state,
      activeSpellEmanations: [...retainedEmanations, {
        ...existingEmanation,
        ...emanation
      }]
    };
  }

  private applyWrathOfNatureEnvironmentalControl(state: CombatState, caster: CombatCharacter): CombatState {
    const effect = this.effect as DamageEffect;
    const position = this.resolvePointTarget() ?? caster.position;
    const existingControls = state.activeEnvironmentalControls || [];
    const retainedControls = existingControls.filter(control =>
      control.spellId !== this.context.spellId ||
      control.casterId !== caster.id
    );
    const createdArea = effect.createdObjects?.find(object => object.objectType === 'animated_nature_cube') ?? effect.createdObjects?.[0];
    const environmentalControl: ActiveEnvironmentalControl = {
      id: `environmental_control_wrath_of_nature_${generateId()}`,
      spellId: this.context.spellId || 'wrath-of-nature',
      spellName: this.context.spellName,
      casterId: caster.id,
      kind: 'wrath_of_nature',
      entityType: effect.controlledEntity?.entityType ?? 'animated_nature_area',
      originPosition: position,
      active: true,
      createdTurn: state.turnState.currentTurn,
      expiresAtRound: this.getEffectExpiryRound(state.turnState.currentTurn),
      area: {
        shape: createdArea?.affectedVolumeShape ?? 'Cube',
        sizeFeet: createdArea?.affectedVolumeSizeFeet ?? 60,
        lineOfSightRequired: true
      },
      terrain: {
        difficultTerrainFor: createdArea?.grassUndergrowthDifficultTerrainFor
      },
      treeAttacks: {
        triggerTiming: effect.areaTiming?.timing,
        targetFilter: effect.areaTiming?.targetFilter,
        radiusFeet: createdArea?.treeAttackRadiusFeet,
        saveAbility: effect.condition.saveType,
        saveOutcome: effect.condition.saveEffect,
        damageDice: effect.damage.dice,
        damageType: effect.damage.type
      }
    };

    return this.addLogEntry({
      ...state,
      activeEnvironmentalControls: [...retainedControls, environmentalControl]
    }, {
      type: 'summon',
      message: `${this.context.spellName || 'Wrath of Nature'} animates the chosen terrain.`,
      characterId: caster.id,
      data: {
        environmentalControlSurface: 'wrath_of_nature',
        environmentalControl,
        removedRecastEnvironmentalControls: existingControls.length - retainedControls.length
      }
    });
  }

  private resolveConjureElementalChoice(): string {
    const rawInput = typeof this.context.playerInput === 'string'
      ? this.context.playerInput.toLowerCase()
      : '';
    const keyedMatch = rawInput.match(/element\s*=\s*(air|earth|fire|water)/i);
    if (keyedMatch) {
      return keyedMatch[1].toLowerCase();
    }

    const directMatch = rawInput.match(/\b(air|earth|fire|water)\b/i);
    return directMatch?.[1]?.toLowerCase() ?? this.effect.controlledEntity?.elementChoice?.[0] ?? 'air';
  }

  private resolveConjureMinorElementalsDamageType(): 'Acid' | 'Cold' | 'Fire' | 'Lightning' {
    const rawInput = typeof this.context.playerInput === 'string'
      ? this.context.playerInput.toLowerCase()
      : '';

    if (rawInput.includes('lightning')) return 'Lightning';
    if (rawInput.includes('fire')) return 'Fire';
    if (rawInput.includes('cold')) return 'Cold';
    if (rawInput.includes('acid')) return 'Acid';

    return 'Acid';
  }

  private resolveConjureElementalDamageType(element: string): string {
    const damageByElement: Record<string, string> = {
      air: 'Lightning',
      earth: 'Thunder',
      fire: 'Fire',
      water: 'Cold'
    };

    return damageByElement[element] ?? this.effect.damage.type;
  }

  private normalizeFaithfulHoundVisibility(visibility: string | undefined): string {
    return visibility?.toLowerCase().includes('caster')
      ? 'caster_only'
      : visibility ?? 'caster_only';
  }

  private getDamageDiceCount(dice: string): number {
    const match = dice.match(/^(\d+)d/i);
    return match ? Number(match[1]) : Number(dice) || 0;
  }

  private extractKeyedPlayerInput(key: string): string | undefined {
    if (typeof this.context.playerInput !== 'string') {
      return undefined;
    }

    const pattern = new RegExp(`${key}\\s*=\\s*([^;|,]+)`, 'i');
    return this.context.playerInput.match(pattern)?.[1]?.trim();
  }

  private resolvePointTarget(): Position | undefined {
    return this.context.selectedSpellTargets
      ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'point' }> => target.kind === 'point')
      ?.position;
  }

  private getEffectExpiryRound(currentTurn: number): number | undefined {
    const duration = this.context.effectDuration;
    if (!duration?.value) {
      return undefined;
    }
    if (duration.type === 'rounds') {
      return currentTurn + Number(duration.value);
    }
    if (duration.type === 'minutes') {
      return currentTurn + (Number(duration.value) * 10);
    }
    if ((duration as { type?: string; unit?: string }).type === 'timed') {
      const timedDuration = duration as unknown as { type: 'timed'; value?: number | string; unit?: string };
      if (timedDuration.unit === 'round' || timedDuration.unit === 'rounds') {
        return currentTurn + Number(timedDuration.value || 0);
      }
      if (timedDuration.unit === 'minute' || timedDuration.unit === 'minutes') {
        return currentTurn + (Number(timedDuration.value || 0) * 10);
      }
      if (timedDuration.unit === 'hour' || timedDuration.unit === 'hours') {
        return currentTurn + (Number(timedDuration.value || 0) * 600);
      }
    }

    return undefined;
  }

  private async breakFriendsWhenTargetTakesDamage(
    state: CombatState,
    damagedTarget: CombatCharacter,
    finalDamage: number
  ): Promise<CombatState> {
    if (finalDamage <= 0) {
      return state;
    }

    // Older saves and deliberately small command fixtures may predate the
    // statusEffects array. Treat that absence as "no Friends charm" so ordinary
    // damage remains compatible while the serialized character is normalized.
    const friendsEffect = damagedTarget.statusEffects?.find(effect =>
      effect.socialLifecycle?.kind === 'friends_charm' &&
      effect.sourceCasterId
    );

    if (!friendsEffect?.sourceCasterId) {
      return state;
    }

    const friendsCaster = state.characters.find(character =>
      character.id === friendsEffect.sourceCasterId &&
      character.concentratingOn?.spellId === 'friends'
    );

    if (!friendsCaster) {
      return state;
    }

    const breakCommand = new BreakConcentrationCommand({
      ...this.context,
      caster: friendsCaster,
      spellId: 'friends',
      spellName: friendsEffect.source || 'Friends',
      targets: []
    });

    const brokenState = await breakCommand.execute(state);
    return this.addLogEntry(brokenState, {
      type: 'status',
      message: `${friendsEffect.source || 'Friends'} ends early because ${damagedTarget.name} takes damage.`,
      characterId: damagedTarget.id,
      targetIds: [damagedTarget.id],
      data: {
        spellId: 'friends',
        earlyEndReason: 'target_takes_damage'
      }
    });
  }

  get description(): string {
    if (isDamageEffect(this.effect)) {
      return `Deals ${this.effect.damage.dice} ${this.effect.damage.type} damage`
    }
    return 'Deals damage'
  }

  private resolveHitPointStateDamageDice(target: CombatCharacter): string {
    if (!isDamageEffect(this.effect)) {
      return '0d0';
    }

    // Toll the Dead keeps one damage row, but the die size depends on whether
    // the target is already wounded. SpellCommandFactory may have already
    // scaled the dice count for cantrip tiers, so this helper preserves the
    // count and only switches the die size from d8 to d12.
    if (
      this.effect.hitPointState?.mode === 'missing_hit_points_damage_step' &&
      target.currentHP < target.maxHP
    ) {
      const diceMatch = this.effect.damage.dice.match(/^(\d+)d(\d+)$/i);
      if (diceMatch) {
        return `${diceMatch[1]}d12`;
      }
    }

    return this.effect.damage.dice;
  }

  /**
   * Grants the caster their Dark One's Blessing temporary hit points after they
   * reduce a creature to 0 HP.
   *
   * The amount was resolved once at combat-character construction
   * (Charisma modifier + warlock level, minimum 1) and stored on
   * `darkOnesBlessingTempHp`. Temporary hit points do not stack in 5e, so the
   * caster keeps the larger of their current temp HP and the fresh blessing
   * value rather than summing them.
   */
  private applyDarkOnesBlessing(
    state: CombatState,
    caster: CombatCharacter
  ): CombatState {
    // Read the freshest caster snapshot so a temp HP grant earlier this
    // resolution is respected by the no-stack comparison below.
    const liveCaster = state.characters.find(character => character.id === caster.id) ?? caster;
    const blessingAmount = liveCaster.darkOnesBlessingTempHp ?? caster.darkOnesBlessingTempHp;

    if (!blessingAmount || blessingAmount <= 0) {
      return state;
    }

    const currentTempHp = liveCaster.tempHP ?? 0;
    if (blessingAmount <= currentTempHp) {
      // The caster already has equal or greater temporary hit points, so the new
      // (non-stacking) grant would be strictly worse. Leave the stronger pool in
      // place and skip the log noise.
      return state;
    }

    const nextState = this.updateCharacter(state, caster.id, {
      tempHP: blessingAmount,
      temporaryHitPointSource: {
        spellId: 'dark_ones_blessing',
        spellName: "Dark One's Blessing",
        casterId: caster.id
      }
    });

    return this.addLogEntry(nextState, {
      type: 'status',
      message: `${caster.name} gains ${blessingAmount} temporary hit points from Dark One's Blessing.`,
      characterId: caster.id,
      targetIds: [caster.id],
      data: { feature: 'dark_ones_blessing', tempHp: blessingAmount }
    });
  }

  /**
   * Applies the effects of the Slasher feat:
   * 1. Reduce speed by 10ft (at most once per turn).
   * 2. On critical hit, target has disadvantage on attacks until start of attacker's next turn.
   */
  private async applySlasherFeat(
    state: CombatState,
    caster: CombatState['characters'][0],
    target: CombatState['characters'][0],
    isCritical: boolean
  ): Promise<CombatState> {
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
      // StatusConditionCommand may resolve saves and reactions asynchronously.
      // Slasher must finish that work before adding its follow-up combat log.
      currentState = await slowCommand.execute(currentState);

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
   * Spend the Resistance spell's flat 1d4 rider after normal resistance math
   * has resolved. The rider is tied to a single chosen damage type and only
   * applies once per turn, so the active effect keeps the last turn it fired.
   */
  private applyResistanceRider(
    state: CombatState,
    target: CombatCharacter,
    incomingDamage: number
  ): { state: CombatState; damage: number } {
    if (!isDamageEffect(this.effect) || incomingDamage <= 0) {
      return { state, damage: incomingDamage };
    }

    const damageType = this.effect.damage.type.toLowerCase();
    const currentTurn = state.turnState?.currentTurn ?? 0;
    const liveTarget = state.characters.find(character => character.id === target.id) ?? target;
    const matchingEffect = liveTarget.activeEffects?.find(effect => {
      const rider = effect.mechanics?.damageReduction;
      if (!rider || rider.appliesTo !== 'damage_taken') return false;
      if ((rider.damageType || '').toLowerCase() !== damageType) return false;
      if (rider.frequency !== 'once_per_turn') return false;
      return rider.lastAppliedTurn !== currentTurn;
    });

    if (!matchingEffect) {
      return { state, damage: incomingDamage };
    }

    const reductionRoll = rollDamageUtil(matchingEffect.mechanics?.damageReduction?.dice || '1d4', false, 1);
    const reducedDamage = Math.max(0, incomingDamage - reductionRoll);
    const updatedActiveEffects = (liveTarget.activeEffects || []).map(effect => {
      if (effect.id !== matchingEffect.id) return effect;

      return {
        ...effect,
        mechanics: {
          ...effect.mechanics,
          damageReduction: effect.mechanics?.damageReduction
            ? {
                ...effect.mechanics.damageReduction,
                lastAppliedTurn: currentTurn
              }
            : effect.mechanics?.damageReduction
        }
      };
    });

    const nextState = this.updateCharacter(state, liveTarget.id, {
      activeEffects: updatedActiveEffects
    });

    const loggedState = this.addLogEntry(nextState, {
      type: 'status',
      message: `${target.name} uses Resistance to reduce ${this.effect.damage.type.toLowerCase()} damage by ${reductionRoll}`,
      characterId: target.id
    });

    return { state: loggedState, damage: reducedDamage };
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

export function recordGuardianOfFaithDamage(
  state: CombatState,
  guardianId: string,
  damageDealt: number,
  options: {
    targetId?: string;
  } = {}
): CombatState {
  const guardian = state.activeSpellGuardians?.find(record => record.id === guardianId);

  if (!guardian) {
    return state;
  }

  const totalDamageDealt = guardian.damageCap.dealtDamage + damageDealt;
  const shouldVanish = guardian.damageCap.vanishWhenReached &&
    totalDamageDealt >= guardian.damageCap.maxTotalDamage;
  const updatedGuardian: ActiveSpellGuardian = {
    ...guardian,
    active: !shouldVanish,
    damageCap: {
      ...guardian.damageCap,
      dealtDamage: totalDamageDealt
    }
  };

  if (shouldVanish) {
    return {
      ...state,
      activeSpellGuardians: (state.activeSpellGuardians || []).filter(record => record.id !== guardianId),
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${guardian.spellName || 'Guardian of Faith'} vanishes after dealing ${totalDamageDealt} damage.`,
          characterId: guardian.casterId,
          targetIds: options.targetId ? [options.targetId] : undefined,
          data: {
            spellGuardianSurface: 'guardian_of_faith',
            guardianId,
            targetId: options.targetId,
            damageDealt,
            totalDamageDealt,
            vanishReason: 'damage_cap_reached'
          }
        }
      ]
    };
  }

  return {
    ...state,
    activeSpellGuardians: (state.activeSpellGuardians || []).map(record =>
      record.id === guardianId ? updatedGuardian : record
    ),
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'damage',
        message: `${guardian.spellName || 'Guardian of Faith'} has dealt ${totalDamageDealt} total damage.`,
        characterId: guardian.casterId,
        targetIds: options.targetId ? [options.targetId] : undefined,
        data: {
          spellGuardianSurface: 'guardian_of_faith',
          guardianId,
          targetId: options.targetId,
          damageDealt,
          totalDamageDealt
        }
      }
    ]
  };
}

export function moveFaithfulHoundGuardian(
  state: CombatState,
  guardianId: string,
  nextPosition: Position,
  options: {
    casterPosition: Position;
  }
): CombatState {
  const guardian = state.activeSpellGuardians?.find(record => record.id === guardianId);

  if (!guardian || guardian.kind !== 'faithful_hound') {
    return state;
  }

  const maxDistanceFeet = guardian.separationEnding?.maxDistanceFeet ?? 300;
  const distanceFromCasterFeet = getGridDistanceFeet(options.casterPosition, nextPosition);
  if (distanceFromCasterFeet > maxDistanceFeet) {
    return {
      ...state,
      activeSpellGuardians: (state.activeSpellGuardians || []).filter(record => record.id !== guardianId),
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${guardian.spellName || "Mordenkainen's Faithful Hound"} ends because it is too far from its caster.`,
          characterId: guardian.casterId,
          data: {
            spellGuardianSurface: 'faithful_hound',
            guardianId,
            endingReason: 'beyond_max_distance',
            distanceFromCasterFeet,
            maxDistanceFeet
          }
        }
      ]
    };
  }

  const movedGuardian: ActiveSpellGuardian = {
    ...guardian,
    position: nextPosition
  };

  return {
    ...state,
    activeSpellGuardians: (state.activeSpellGuardians || []).map(record =>
      record.id === guardianId ? movedGuardian : record
    ),
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'movement',
        message: `${guardian.spellName || "Mordenkainen's Faithful Hound"} moves up to ${guardian.movement?.maxDistanceFeet ?? 30} feet.`,
        characterId: guardian.casterId,
        data: {
          spellGuardianSurface: 'faithful_hound',
          guardianId,
          moveReason: 'magic_action',
          position: nextPosition
        }
      }
    ]
  };
}

export function recordConjureElementalRestraint(
  state: CombatState,
  guardianId: string,
  options: {
    targetId: string;
    failedSave: boolean;
  }
): CombatState {
  const guardian = state.activeSpellGuardians?.find(record => record.id === guardianId);

  if (!guardian || guardian.kind !== 'conjure_elemental' || !options.failedSave) {
    return state;
  }

  const updatedGuardian: ActiveSpellGuardian = {
    ...guardian,
    elementalSpirit: {
      ...guardian.elementalSpirit,
      restrainedTargetId: options.targetId
    }
  };

  return {
    ...state,
    activeSpellGuardians: (state.activeSpellGuardians || []).map(record =>
      record.id === guardianId ? updatedGuardian : record
    ),
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${guardian.spellName || 'Conjure Elemental'} restrains ${options.targetId}.`,
        characterId: guardian.casterId,
        targetIds: [options.targetId],
        data: {
          spellGuardianSurface: 'conjure_elemental',
          guardianId,
          restrainedTargetId: options.targetId,
          damageDice: guardian.elementalSpirit?.initialDamageDice ?? guardian.triggerPolicy.damageDice,
          damageType: guardian.elementalSpirit?.damageType ?? guardian.triggerPolicy.damageType
        }
      }
    ]
  };
}

export function resolveConjureElementalRepeatSave(
  state: CombatState,
  guardianId: string,
  options: {
    targetId: string;
    failedSave: boolean;
  }
): CombatState {
  const guardian = state.activeSpellGuardians?.find(record => record.id === guardianId);

  if (!guardian || guardian.kind !== 'conjure_elemental') {
    return state;
  }

  const repeatDamageDice = guardian.elementalSpirit?.repeatDamageDice ?? '4d8';
  if (options.failedSave) {
    return {
      ...state,
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'damage',
          message: `${guardian.spellName || 'Conjure Elemental'} deals repeat damage to ${options.targetId}.`,
          characterId: guardian.casterId,
          targetIds: [options.targetId],
          data: {
            spellGuardianSurface: 'conjure_elemental',
            guardianId,
            repeatSaveOutcome: 'failed',
            damageDice: repeatDamageDice,
            damageType: guardian.elementalSpirit?.damageType ?? guardian.triggerPolicy.damageType
          }
        }
      ]
    };
  }

  const updatedGuardian: ActiveSpellGuardian = {
    ...guardian,
    elementalSpirit: {
      ...guardian.elementalSpirit,
      restrainedTargetId: undefined
    }
  };

  return {
    ...state,
    activeSpellGuardians: (state.activeSpellGuardians || []).map(record =>
      record.id === guardianId ? updatedGuardian : record
    ),
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${options.targetId} is no longer restrained by ${guardian.spellName || 'Conjure Elemental'}.`,
        characterId: guardian.casterId,
        targetIds: [options.targetId],
        data: {
          spellGuardianSurface: 'conjure_elemental',
          guardianId,
          repeatSaveOutcome: 'succeeded',
          releasedTargetId: options.targetId
        }
      }
    ]
  };
}

function getGridDistanceFeet(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt((dx * dx) + (dy * dy)) * 5;
}
