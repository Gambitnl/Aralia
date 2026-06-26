import React from 'react';
import { Spell, SpellEffect, DamageEffect, HealingEffect, CastingTime, Range } from '../../types';

export type SpellSummaryCardDensity = 'card' | 'row';

interface SpellSummaryCardProps {
  spell: Spell;
  selected?: boolean;
  disabled?: boolean;
  density?: SpellSummaryCardDensity;
  inputId?: string;
  showCheckbox?: boolean;
  onToggle?: () => void;
  onSelect?: () => void;
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
  statusBadges?: React.ReactNode;
  className?: string;
}

export const formatSpellCastingTime = (ct: CastingTime): string => {
  if (ct.unit === 'action') return `${ct.value} Action`;
  if (ct.unit === 'bonus_action') return `${ct.value} Bonus Action`;
  if (ct.unit === 'reaction') return ct.reactionCondition ? `Reaction, ${ct.reactionCondition}` : 'Reaction';
  if (ct.unit === 'minute') return `${ct.value} Minute${ct.value > 1 ? 's' : ''}`;
  if (ct.unit === 'hour') return `${ct.value} Hour${ct.value > 1 ? 's' : ''}`;
  return `${ct.value} ${ct.unit}${ct.value > 1 ? 's' : ''}`;
};

export const formatSpellRange = (range: Range): string => {
  if (range.type === 'self') return 'Self';
  if (range.type === 'touch') return 'Touch';
  if (range.type === 'ranged' || range.type === 'sight') return `${range.distance} ${range.distanceUnit || 'ft'}`;
  return 'Special';
};

export const getSpellEffectSummary = (spell: Spell): { label: string; text: string; color: string } | null => {
  if (!spell.effects) return null;

  const damageEffect = spell.effects.find((effect: SpellEffect) => effect.type === 'DAMAGE') as DamageEffect | undefined;
  if (damageEffect?.damage) {
    return {
      label: 'Damage',
      text: `${damageEffect.damage.dice} ${damageEffect.damage.type}`,
      color: 'text-red-400',
    };
  }

  const healingEffect = spell.effects.find((effect: SpellEffect) => effect.type === 'HEALING') as HealingEffect | undefined;
  if (healingEffect) {
    return {
      label: 'Healing',
      text: healingEffect.healing?.dice ?? '',
      color: 'text-emerald-400',
    };
  }

  return null;
};

/**
 * SpellSummaryCard is the shared spell list/selection surface for Character Creator
 * and Character Sheet spell lists. Variants preserve each host flow's behavior while
 * keeping names, school tags, components, timing, range, and effect summaries aligned.
 */
export const SpellSummaryCard: React.FC<SpellSummaryCardProps> = ({
  spell,
  selected = false,
  disabled = false,
  density = 'card',
  inputId,
  showCheckbox = false,
  onToggle,
  onSelect,
  leadingIcon,
  trailing,
  statusBadges,
  className = '',
}) => {
  const summary = getSpellEffectSummary(spell);
  const isRow = density === 'row';
  const Container: React.ElementType = inputId ? 'label' : 'div';
  const containerProps = inputId ? { htmlFor: inputId } : {};

  const handleClick = () => {
    if (disabled) return;
    if (onSelect) onSelect();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!onSelect || disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <Container
      {...containerProps}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect && !disabled ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-disabled={onSelect ? disabled : undefined}
      className={`${isRow ? 'p-2.5 rounded-lg border-l-4 flex items-center justify-between gap-3' : 'p-3 rounded-lg border flex flex-col h-full'} transition-all ${
        selected
          ? isRow
            ? 'bg-purple-500/20 border-purple-500'
            : 'bg-sky-900/40 border-sky-500 shadow-md ring-1 ring-sky-500/50'
          : disabled
            ? 'bg-gray-800/50 border-gray-700/50 opacity-60 cursor-not-allowed grayscale-[30%]'
            : isRow
              ? 'bg-slate-800/20 border-transparent hover:bg-slate-700/50 hover:border-slate-600 cursor-pointer'
              : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-700/80 cursor-pointer'
      } ${className}`}
    >
      <div className={`${isRow ? 'flex items-center gap-2 min-w-0 flex-1' : 'flex items-start gap-3 mb-2'}`}>
        {showCheckbox && inputId && (
          <input
            type="checkbox"
            id={inputId}
            className="form-checkbox h-4 w-4 mt-1 text-sky-500 bg-gray-950 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-900"
            checked={selected}
            onChange={onToggle}
            disabled={disabled}
          />
        )}
        {leadingIcon}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`${isRow ? 'text-sm' : 'text-sm font-bold'} truncate ${selected ? 'text-white font-medium' : 'text-gray-200'}`}>
              {spell.name}
            </span>
            {!isRow && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500 flex-shrink-0">
                {spell.school.substring(0, 4)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {isRow && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold tracking-wider">
                {spell.school}
              </span>
            )}
            {spell.duration?.concentration && (
              <span className="text-[9px] bg-amber-900/40 text-amber-300 px-1 py-0.5 rounded border border-amber-700/50" title="Concentration">
                C
              </span>
            )}
            {spell.ritual && (
              <span className="text-[9px] bg-purple-900/40 text-purple-300 px-1 py-0.5 rounded border border-purple-700/50" title="Ritual">
                R
              </span>
            )}
            {spell.components?.verbal && <span className="text-[9px] text-gray-400">V</span>}
            {spell.components?.somatic && <span className="text-[9px] text-gray-400">S</span>}
            {spell.components?.material && <span className="text-[9px] text-gray-400">M</span>}
            {statusBadges}
          </div>
        </div>
      </div>

      {!isRow && (
        <>
          <div className="mt-auto pt-2 border-t border-gray-700/50 grid grid-cols-2 gap-x-2 gap-y-1">
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-wider text-gray-500">Time</span>
              <span className="text-[10px] text-gray-300 truncate" title={formatSpellCastingTime(spell.castingTime)}>
                {formatSpellCastingTime(spell.castingTime)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-wider text-gray-500">Range</span>
              <span className="text-[10px] text-gray-300 truncate" title={formatSpellRange(spell.range)}>
                {formatSpellRange(spell.range)}
              </span>
            </div>
          </div>

          {summary && (
            <div className="mt-1 pt-1 border-t border-gray-700/30 flex justify-between items-center">
              <span className="text-[8px] uppercase tracking-wider text-gray-500">{summary.label}</span>
              <span className={`text-[11px] font-bold ${summary.color}`}>{summary.text}</span>
            </div>
          )}
        </>
      )}

      {isRow && trailing}
    </Container>
  );
};
