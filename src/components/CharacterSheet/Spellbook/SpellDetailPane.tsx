/**
 * @file SpellDetailPane.tsx
 * Displays detailed spell information using SpellContext data.
 * Designed to match the glossary entry style.
 */
import React from 'react';
import { Spell } from '../../../types';

interface SpellDetailPaneProps {
    spell: Spell;
}

const formatCastingTime = (ct: Spell['castingTime']): string => {
    if (ct.unit === 'action') return '1 Action';
    if (ct.unit === 'bonus_action') return '1 Bonus Action';
    if (ct.unit === 'reaction') return `1 Reaction${ct.reactionCondition ? `, ${ct.reactionCondition}` : ''}`;
    if (ct.unit === 'minute') return `${ct.value} Minute${ct.value > 1 ? 's' : ''}`;
    if (ct.unit === 'hour') return `${ct.value} Hour${ct.value > 1 ? 's' : ''}`;
    return 'Special';
};

const formatRange = (range: Spell['range']): string => {
    if (range.type === 'self') return 'Self';
    if (range.type === 'touch') return 'Touch';
    if (range.type === 'ranged' && range.distance) return `${range.distance} feet`;
    return 'Special';
};

const formatComponents = (comp: Spell['components']): string => {
    const parts: string[] = [];
    if (comp.verbal) parts.push('V');
    if (comp.somatic) parts.push('S');
    if (comp.material) parts.push(comp.materialDescription ? `M (${comp.materialDescription})` : 'M');
    return parts.join(', ') || '—';
};

const formatDuration = (dur: Spell['duration']): string => {
    if (dur.type === 'instantaneous') return 'Instantaneous';
    if (dur.type === 'until_dispelled') return 'Until Dispelled';
    if (dur.type === 'until_dispelled_or_triggered') return 'Until Dispelled or Triggered';
    if (dur.type === 'timed' && dur.value && dur.unit) {
        const prefix = dur.concentration ? 'Concentration, up to ' : '';
        const unitLabel = dur.unit.charAt(0).toUpperCase() + dur.unit.slice(1);
        return `${prefix}${dur.value} ${unitLabel}${dur.value > 1 ? 's' : ''}`;
    }
    return dur.concentration ? 'Concentration' : 'Special';
};

const SpellDetailPane: React.FC<SpellDetailPaneProps> = ({ spell }) => {
    const levelText = spell.level === 0
        ? `${spell.school} Cantrip`
        : `Level ${spell.level} ${spell.school}`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold text-white mb-1 font-display">
                    {spell.name}
                </h2>
                <p className="text-sm text-purple-400 font-bold tracking-widest uppercase">
                    {levelText}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/30 flex flex-col items-center text-center">
                    <p className="text-[10px] uppercase text-amber-400 font-bold mb-1 tracking-widest">Casting Time</p>
                    <p className="text-sm font-semibold text-slate-200">{formatCastingTime(spell.castingTime)}</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/30 flex flex-col items-center text-center">
                    <p className="text-[10px] uppercase text-amber-400 font-bold mb-1 tracking-widest">Range</p>
                    <p className="text-sm font-semibold text-slate-200">{formatRange(spell.range)}</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/30 flex flex-col items-center text-center">
                    <p className="text-[10px] uppercase text-amber-400 font-bold mb-1 tracking-widest">Components</p>
                    <p className="text-sm font-semibold text-slate-200">{formatComponents(spell.components)}</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/30 flex flex-col items-center text-center">
                    <p className="text-[10px] uppercase text-amber-400 font-bold mb-1 tracking-widest">Duration</p>
                    <p className="text-sm font-semibold text-slate-200">{formatDuration(spell.duration)}</p>
                </div>
            </div>

            {/* Description */}
            <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed">
                <p className="text-slate-300 text-base">{spell.description}</p>

                {/* Higher Levels */}
                {spell.higherLevels && (
                    <div className="mt-6 p-4 rounded-lg bg-slate-800/40 border-l-2 border-amber-400/40">
                        <h4 className="text-xs uppercase tracking-[0.15em] text-amber-400 font-bold mb-2">
                            At Higher Levels
                        </h4>
                        <p className="text-slate-400 text-sm">{spell.higherLevels}</p>
                    </div>
                )}
            </div>

            {/* Tags/Classes */}
            {spell.classes && spell.classes.length > 0 && (
                <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Classes:</span>
                    <div className="flex flex-wrap gap-1">
                        {spell.classes.map(cls => (
                            <span key={cls} className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                                {cls.charAt(0).toUpperCase() + cls.slice(1)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Ritual Tag */}
            {spell.ritual && (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold tracking-wider">
                        Ritual
                    </span>
                </div>
            )}
        </div>
    );
};

export default SpellDetailPane;
