import React from 'react';
import { Spell, SpellEffect, DamageEffect, HealingEffect } from '../../../types';

interface SpellCardProps {
  spell: Spell;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  idPrefix?: string;
  className?: string;
}

export const SpellCard: React.FC<SpellCardProps> = ({
  spell,
  selected,
  disabled,
  onToggle,
  idPrefix = 'spell',
  className = '',
}) => {
  const getSpellSummary = (spell: Spell): { label: string; text: string; color: string } | null => {
    if (!spell.effects) return null;

    const damageEffect = spell.effects.find((e: SpellEffect) => e.type === 'DAMAGE') as DamageEffect | undefined;
    if (damageEffect && damageEffect.damage) {
      return {
        label: 'Damage',
        text: `${damageEffect.damage.dice} ${damageEffect.damage.type}`,
        color: 'text-red-400'
      };
    }

    const healEffect = spell.effects.find((e: SpellEffect) => e.type === 'HEALING') as HealingEffect | undefined;
    if (healEffect) {
      const text = healEffect.healing ? healEffect.healing.dice : "";
      return {
        label: 'Healing',
        text: text,
        color: 'text-emerald-400'
      };
    }

    return null;
  };

  const summary = getSpellSummary(spell);
  const inputId = `${idPrefix}-${spell.id}`;

  const formatCastingTime = (ct: any) => {
    if (ct.unit === 'action') return `${ct.value} Action`;
    if (ct.unit === 'bonus_action') return `${ct.value} Bonus Action`;
    if (ct.unit === 'reaction') return 'Reaction';
    return `${ct.value} ${ct.unit}${ct.value > 1 ? 's' : ''}`;
  };

  const formatRange = (r: any) => {
    if (r.type === 'self') return 'Self';
    if (r.type === 'touch') return 'Touch';
    if (r.type === 'ranged' || r.type === 'sight') return `${r.distance} ${r.distanceUnit || 'ft'}`;
    return 'Special';
  };

  return (
    <label
      htmlFor={inputId}
      className={`p-3 rounded-lg cursor-pointer transition-all border flex flex-col h-full ${
        selected
          ? 'bg-sky-900/40 border-sky-500 shadow-md ring-1 ring-sky-500/50'
          : disabled
            ? 'bg-gray-800/50 border-gray-700/50 opacity-60 cursor-not-allowed grayscale-[30%]'
            : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-700/80'
      } ${className}`}
    >
      <div className="flex items-start gap-3 mb-2">
        <input
          type="checkbox"
          id={inputId}
          className="form-checkbox h-4 w-4 mt-1 text-sky-500 bg-gray-950 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-900"
          checked={selected}
          onChange={onToggle}
          disabled={disabled}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className={`text-sm font-bold truncate ${selected ? 'text-sky-200' : 'text-gray-200'}`}>
              {spell.name}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500 flex-shrink-0 mt-1">
              {spell.school.substring(0, 4)}
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            {spell.duration?.concentration && (
              <span className="text-[9px] bg-amber-900/40 text-amber-300 px-1 py-0.5 rounded border border-amber-700/50" title="Concentration">C</span>
            )}
            {spell.ritual && (
              <span className="text-[9px] bg-purple-900/40 text-purple-300 px-1 py-0.5 rounded border border-purple-700/50" title="Ritual">R</span>
            )}
            {spell.components?.verbal && <span className="text-[9px] text-gray-400">V</span>}
            {spell.components?.somatic && <span className="text-[9px] text-gray-400">S</span>}
            {spell.components?.material && <span className="text-[9px] text-gray-400">M</span>}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-2 border-t border-gray-700/50 grid grid-cols-2 gap-x-2 gap-y-1">
        <div className="flex flex-col">
          <span className="text-[8px] uppercase tracking-wider text-gray-500">Time</span>
          <span className="text-[10px] text-gray-300 truncate" title={formatCastingTime(spell.castingTime)}>
            {formatCastingTime(spell.castingTime)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] uppercase tracking-wider text-gray-500">Range</span>
          <span className="text-[10px] text-gray-300 truncate" title={formatRange(spell.range)}>
            {formatRange(spell.range)}
          </span>
        </div>
      </div>

      {summary && (
        <div className="mt-1 pt-1 border-t border-gray-700/30 flex justify-between items-center">
           <span className="text-[8px] uppercase tracking-wider text-gray-500">{summary.label}</span>
           <span className={`text-[11px] font-bold ${summary.color}`}>{summary.text}</span>
        </div>
      )}
    </label>
  );
};
