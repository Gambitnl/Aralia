/**
 * @file SpellSlotDisplay.tsx
 * Compact spell slot visualization for the spellbook header.
 */
import React from 'react';
import { SpellSlots } from '../../../types';

interface SpellSlotDisplayProps {
    spellSlots: SpellSlots | undefined;
}

const SpellSlotDisplay: React.FC<SpellSlotDisplayProps> = ({ spellSlots }) => {
    if (!spellSlots) return null;

    const slots = Object.entries(spellSlots)
        .filter(([, slot]) => slot.max > 0)
        .sort(([a], [b]) => {
            const levelA = parseInt(a.replace('level_', ''));
            const levelB = parseInt(b.replace('level_', ''));
            return levelA - levelB;
        });

    if (slots.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-3">
            {slots.map(([key, slot]) => {
                const level = key.replace('level_', '');
                const percentage = slot.max > 0 ? (slot.current / slot.max) * 100 : 0;

                return (
                    <div key={key} className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                            Lvl {level}
                        </span>
                        <div className="relative w-10 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 bg-purple-500 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-slate-300 mt-0.5">
                            {slot.current}/{slot.max}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default SpellSlotDisplay;
