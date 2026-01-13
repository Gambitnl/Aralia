import React from 'react';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';

interface SpellLevel {
    minLevel: number;
    spells: string[];
}

interface GlossarySpellsOfTheMarkTableProps {
    spells: SpellLevel[];
    onNavigate?: (termId: string) => void;
    variant?: 'default' | 'embedded';
}

export const GlossarySpellsOfTheMarkTable: React.FC<GlossarySpellsOfTheMarkTableProps> = ({
    spells,
    onNavigate,
    variant = 'default'
}) => {
    if (!spells || spells.length === 0) return null;

    const isEmbedded = variant === 'embedded';

    if (isEmbedded) {
        return (
            <div className="mt-3">
                <table className="w-full text-left text-xs bg-black/20 rounded border-collapse">
                    <thead>
                        <tr className="border-b border-gray-600">
                            <th className="py-2 px-3 font-semibold text-amber-300 uppercase tracking-wider w-24">Level</th>
                            <th className="py-2 px-3 font-semibold text-amber-300 uppercase tracking-wider">Spells</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/30">
                        {spells.map((level, index) => (
                            <tr key={index} className="hover:bg-gray-800/30 transition-colors">
                                <td className="py-2 px-3 text-amber-400/90 font-mono">
                                    {level.minLevel}
                                </td>
                                <td className="py-2 px-3 text-gray-300">
                                    <div className="flex flex-wrap gap-2">
                                        {level.spells.map((spell, i) => (
                                            <span key={i}>
                                                <GlossaryContentRenderer
                                                    markdownContent={spell}
                                                    onNavigate={onNavigate}
                                                    className="text-sky-400 hover:text-sky-300 underline"
                                                />
                                                {i < level.spells.length - 1 && <span className="text-gray-600 select-none">, </span>}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-lg border border-gray-600 shadow-lg bg-gray-900/40 mt-4">
             <div className="bg-gray-800/60 px-4 py-2 border-b border-gray-600">
                <h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>
            </div>
            <table className="w-full text-left text-xs bg-black/20 rounded-b border-collapse">
                <thead>
                    <tr className="border-b border-gray-600">
                        <th className="py-2 px-4 font-semibold text-sky-400 uppercase tracking-wider w-32">Spell Level</th>
                        <th className="py-2 px-4 font-semibold text-sky-400 uppercase tracking-wider">Spells</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                    {spells.map((level, index) => (
                        <tr key={index} className="hover:bg-gray-800/50 transition-colors">
                            <td className="py-2 px-4 text-gray-400 font-mono">
                                Level {level.minLevel}
                            </td>
                            <td className="py-2 px-4 text-gray-300">
                                <div className="flex flex-wrap gap-2">
                                    {level.spells.map((spell, i) => (
                                        <span key={i}>
                                            <GlossaryContentRenderer
                                                markdownContent={spell}
                                                onNavigate={onNavigate}
                                            />
                                            {i < level.spells.length - 1 && <span className="text-gray-600 select-none">, </span>}
                                        </span>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
