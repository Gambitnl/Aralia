import React from 'react';
import { GlossaryIcon } from './IconRegistry';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';

interface Trait {
    name: string;
    icon: string;
    description: string;
}

interface GlossaryTraitTableProps {
    traits: Trait[];
    onNavigate?: (termId: string) => void;
}

/**
 * Renders a list of traits in a premium table format.
 * Features hover effects, icon integration, and structured text rendering.
 */
export const GlossaryTraitTable: React.FC<GlossaryTraitTableProps> = ({
    traits,
    onNavigate
}) => {
    if (!traits || traits.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-lg border border-gray-600 shadow-lg">
            <table className="min-w-full divide-y divide-gray-600 border-collapse">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-sky-300 uppercase tracking-tighter w-1/4">
                            Trait
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-sky-300 uppercase tracking-tighter">
                            Description
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800/50 divide-y divide-gray-700">
                    {traits.map((trait, index) => (
                        <tr
                            key={index}
                            className="hover:bg-gray-700/40 transition-colors duration-150 group"
                        >
                            <td className="px-5 py-5 text-sm font-semibold text-amber-300 align-top">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400 group-hover:scale-110 transition-transform">
                                        <GlossaryIcon name={trait.icon} className="w-4 h-4" />
                                    </div>
                                    <span>{trait.name}</span>
                                </div>
                            </td>
                            <td className="px-5 py-5 text-sm text-gray-300 leading-relaxed align-top">
                                <GlossaryContentRenderer
                                    markdownContent={trait.description}
                                    onNavigate={onNavigate}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
