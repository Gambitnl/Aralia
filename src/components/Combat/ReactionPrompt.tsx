/**
 * @file ReactionPrompt.tsx
 * Modal component for displaying reaction opportunities (e.g. Shield spell)
 * and capturing user choice.
 */
import React from 'react';
import { Spell } from '../../types/spells';

interface ReactionPromptProps {
    attackerName: string;
    reactionSpells: Spell[];
    triggerType: string;
    onResolve: (usedSpellId: string | null) => void;
}

export const ReactionPrompt: React.FC<ReactionPromptProps> = ({
    attackerName,
    reactionSpells,
    triggerType,
    onResolve
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-purple-500/50 rounded-xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200 ring-1 ring-white/10">

                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                        Reaction Opportunity!
                    </h2>
                    <div className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs rounded uppercase tracking-wider font-semibold">
                        {triggerType.replace('_', ' ')}
                    </div>
                </div>

                <p className="text-gray-300 mb-6 leading-relaxed">
                    <span className="text-white font-medium">{attackerName}</span> hit you!
                    Would you like to use your reaction?
                </p>

                <div className="space-y-3 mb-6">
                    {reactionSpells.map((spell) => (
                        <button
                            key={spell.id}
                            onClick={() => onResolve(spell.id)}
                            className="w-full group relative overflow-hidden p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500/50 hover:bg-gray-800/80 transition-all duration-200 text-left"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="flex items-center justify-between relative z-10">
                                <span className="font-semibold text-purple-300 group-hover:text-purple-200 transition-colors">
                                    Cast {spell.name}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                    1 Reaction + Slot
                                </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                {spell.description}
                            </div>
                        </button>
                    ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-800">
                    <button
                        onClick={() => onResolve(null)}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium hover:bg-white/5 rounded-lg"
                    >
                        Skip Reaction
                    </button>
                </div>
            </div>
        </div>
    );
};
