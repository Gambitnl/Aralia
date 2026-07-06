/**
 * @file AbilityPalette.tsx
 * Displays the abilities for the currently selected character.
 * Supports pop-out into a draggable/resizable WindowFrame modal. The embedded
 * trigger uses a full touch-sized target so the combat command rail remains
 * usable when the 2D layout collapses into a narrow column.
 */
import React, { useState } from 'react';
import { CombatCharacter, Ability, AbilityCost } from '../../types/combat';
import AbilityButton from './AbilityButton';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

interface AbilityPaletteProps {
  character: CombatCharacter | null;
  onSelectAbility: (ability: Ability) => void;
  canAffordAction: (cost: AbilityCost) => boolean;
}

const AbilityPalette: React.FC<AbilityPaletteProps> = ({ character, onSelectAbility, canAffordAction }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!character) {
    return <div className="p-2 text-center text-gray-400 italic">Select a character to see abilities.</div>;
  }

  const toGrantedActionCost = (type: string): AbilityCost['type'] => {
    if (type === 'bonus_action') return 'bonus';
    return type as AbilityCost['type'];
  };

  const toGrantedActionDamageType = (damageType?: string): Ability['effects'][number]['damageType'] | undefined => {
    // Spell JSON keeps rules-text damage names in title case, while battle-map
    // abilities use lowercase tokens. Normalize only the runtime bridge so the
    // durable source data keeps its existing spelling style.
    return damageType?.toLowerCase() as Ability['effects'][number]['damageType'] | undefined;
  };

  const toGrantedActionAreaOfEffect = (grantedAction: NonNullable<Ability['grantedActions']>[number]): Ability['areaOfEffect'] | undefined => {
    // Granted follow-up actions can carry their own area template even when the
    // original cast is not an area button. Convert canonical spell shapes into
    // the existing battle-map preview shapes instead of inventing a second AoE
    // model for secondary spell actions.
    if (!grantedAction.areaShape || grantedAction.areaShape === 'not_applicable' || grantedAction.areaSize === 'not_applicable' || grantedAction.areaSizeUnit !== 'feet') {
      return undefined;
    }

    const shapeMap: Record<string, NonNullable<Ability['areaOfEffect']>['shape'] | undefined> = {
      Cone: 'cone',
      Line: 'line',
      Sphere: 'circle',
      Cube: 'square',
      Cylinder: 'circle'
    };
    const shape = shapeMap[grantedAction.areaShape];
    if (!shape) {
      return undefined;
    }

    return {
      shape,
      size: Math.max(1, Math.floor(grantedAction.areaSize / 5))
    };
  };

  const toGrantedActionAbilityAttackType = (grantedAction: NonNullable<Ability['grantedActions']>[number]): Ability['attackType'] | undefined => {
    // Granted actions such as Wall of Light's beam are still routed through
    // GrantedActionCommand, but the generated combat button should advertise
    // that it is a spell attack. Shared rider and preview systems can then
    // distinguish it from a ranged weapon attack without reparsing the payload.
    if (
      grantedAction.attackType === 'ranged_spell_attack' ||
      grantedAction.attackType === 'melee_spell_attack'
    ) {
      return 'spell';
    }

    return undefined;
  };

  const abilitiesWithGrantedActions = character.abilities.flatMap(ability => {
    const grantedActionAbilities = (ability.grantedActions ?? []).map((grantedAction, index): Ability => {
      const areaOfEffect = toGrantedActionAreaOfEffect(grantedAction);

      return {
        id: `${ability.id}_granted_${index}_${grantedAction.action.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        sourceSpellId: ability.sourceSpellId ?? ability.spell?.id ?? ability.id,
        name: grantedAction.action,
        description: grantedAction.notes ?? `Follow-up action granted by ${ability.name}.`,
        type: 'utility',
        icon: '+',
        cost: { type: toGrantedActionCost(grantedAction.type) },
        // Granted actions with a range limit, such as Wall of Light's beam,
        // should enter the normal target-selection flow instead of logging as a
        // self-only utility. Area follow-ups, such as Melf's meteors, route to
        // the normal area picker so their later point/area payload is visible.
        targeting: areaOfEffect
          ? 'area'
          : grantedAction.rangeLimit
            ? (grantedAction.prerequisites?.includes('target_object_within_spell_range') ? 'single_any' : 'single_enemy')
            : 'self',
        range: grantedAction.rangeLimit ? Math.floor(grantedAction.rangeLimit / 5) : 0,
        areaShape: areaOfEffect?.shape,
        areaSize: areaOfEffect?.size,
        areaOfEffect,
        attackType: toGrantedActionAbilityAttackType(grantedAction),
        effects: [{
          type: 'granted_action',
          grantedActionLabel: grantedAction.action,
          grantedActionCost: grantedAction.type,
          grantedActionFrequency: grantedAction.frequency,
          grantedActionRangeLimit: grantedAction.rangeLimit,
          grantedActionPrerequisites: grantedAction.prerequisites,
          grantedActionAttackType: grantedAction.attackType,
          grantedActionAreaShape: grantedAction.areaShape,
          grantedActionAreaSize: grantedAction.areaSize,
          grantedActionAreaSizeUnit: grantedAction.areaSizeUnit,
          grantedActionDamageDice: grantedAction.damage?.dice,
          grantedActionDamageType: toGrantedActionDamageType(grantedAction.damage?.type),
          grantedActionSaveType: grantedAction.saveType,
          grantedActionSaveEffect: grantedAction.saveEffect,
          grantedActionDamageAbilityModifier: grantedAction.damageAbilityModifier,
          grantedActionWallLengthReduction: grantedAction.wallLengthReduction,
          grantedActionEndsWhenLengthZero: grantedAction.endsWhenLengthZero,
          grantedActionNotes: grantedAction.notes
        }],
        tags: ['spell-granted-action', ability.id],
        spell: ability.spell
      };
    });

    // Show the original spell button and then the follow-up actions it grants.
    // This makes the secondary actions selectable without mutating the
    // character's canonical ability list or pretending every spell-specific
    // payload is already implemented.
    return [ability, ...grantedActionAbilities];
  });

  const abilityButtons = (
    <div className="flex justify-center flex-wrap gap-2 p-3">
      {abilitiesWithGrantedActions.map(ability => {
        const isAffordable = canAffordAction(ability.cost);
        const isOnCooldown = (ability.currentCooldown || 0) > 0;
        const isExhausted = ability.maxUses !== undefined && (ability.usesRemaining ?? ability.maxUses) <= 0;
        const isDisabled = !isAffordable || isOnCooldown || isExhausted;
        return (
          <AbilityButton
            key={ability.id}
            ability={ability}
            onSelect={() => onSelectAbility(ability)}
            isDisabled={isDisabled}
          />
        );
      })}
    </div>
  );

  return (
    <>
      <div className="rounded-xl border border-amber-900/40 bg-slate-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-amber-900/40">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400/90">Abilities</h3>
          <button
            onClick={() => setIsExpanded(true)}
            className="flex h-11 w-11 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            title="Pop out into resizable window"
            aria-label="Pop out Abilities into resizable window"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
        {isExpanded ? (
          <div className="p-3 text-gray-400 text-xs italic text-center">Abilities are popped out.</div>
        ) : abilityButtons}
      </div>

      {isExpanded && (
        <WindowFrame
          title={`${character.name}'s Abilities`}
          onClose={() => setIsExpanded(false)}
          storageKey={WINDOW_KEYS.ABILITY_PALETTE}
          initialMaximized={false}
        >
          <div className="h-full overflow-y-auto bg-gray-900 scrollable-content">
            {abilityButtons}
          </div>
        </WindowFrame>
      )}
    </>
  );
};

export default AbilityPalette;
