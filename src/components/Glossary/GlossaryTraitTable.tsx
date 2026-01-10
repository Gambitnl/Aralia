import React from 'react';
import { GlossaryIcon } from './IconRegistry';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';

interface Trait {
    name: string;
    icon: string;
    description: string;
}

interface Characteristic {
    label: string;
    value: string;
}

interface GlossaryTraitTableProps {
    traits: Trait[];
    characteristics?: Characteristic[];
    onNavigate?: (termId: string) => void;
}

/**
 * Renders a unified table of characteristics and traits in spell progression style.
 * Combines base stats (Creature Type, Size, Speed, Darkvision) with racial traits.
 * Features icon integration and structured text rendering.
 */
export const GlossaryTraitTable: React.FC<GlossaryTraitTableProps> = ({
    traits,
    characteristics = [],
    onNavigate
}) => {
    if (!traits || traits.length === 0) return null;

    // Extract base stats from characteristics
    const creatureType = characteristics.find(c => c.label === 'Creature Type');
    const size = characteristics.find(c => c.label === 'Size');
    const speed = characteristics.find(c => c.label === 'Speed');

    // Find darkvision or special vision traits
    const darkvisionTrait = traits.find(t => t.name === 'Darkvision' || t.name.includes('Darkvision'));
    const specialVisionTraits = traits.filter(t =>
        t.name.includes('vision') ||
        t.name === 'Tremorsense' ||
        t.name === 'Blindsight' ||
        t.name === 'Truesight'
    );

    // Determine vision text
    let visionText = 'Normal';
    let visionIcon = '👁️';

    if (darkvisionTrait) {
        // Try to extract range from description (e.g., "60 feet" or "120 feet")
        const rangeMatch = darkvisionTrait.description.match(/(\d+)\s*feet/);
        const range = rangeMatch ? rangeMatch[1] : '60';
        visionText = `Darkvision (${range} feet)`;
    } else if (specialVisionTraits.length > 0) {
        // Use the first special vision trait found
        const specialVision = specialVisionTraits[0];
        const rangeMatch = specialVision.description.match(/(\d+)\s*feet/);
        const range = rangeMatch ? ` (${rangeMatch[1]} feet)` : '';
        visionText = `${specialVision.name}${range}`;
    }

    // Get all other traits (excluding vision-related traits since they're shown in the Vision row)
    const otherTraits = traits.filter(t =>
        t.name !== 'Darkvision' &&
        !t.name.includes('Darkvision') &&
        !specialVisionTraits.some(sv => sv.name === t.name)
    );

    return (
        <div className="overflow-hidden rounded-lg border border-gray-600 shadow-lg bg-gray-900/40">
            <table className="w-full text-left text-xs bg-black/20 rounded border-collapse [&_p]:m-0 [&_p]:leading-relaxed">
                <thead>
                    <tr className="border-b border-gray-600">
                        <th className="py-3 px-4 font-semibold text-amber-300 uppercase tracking-wider">Trait</th>
                        <th className="py-3 px-4 font-semibold text-amber-300 uppercase tracking-wider">Description</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                    {/* Creature Type */}
                    {creatureType && (
                        <tr className="hover:bg-gray-800/50 transition-colors">
                            <td className="py-3 px-4 align-top">
                                <span className="text-sky-400 font-semibold">Creature Type</span>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                                <GlossaryContentRenderer
                                    markdownContent={creatureType.value}
                                    onNavigate={onNavigate}
                                />
                            </td>
                        </tr>
                    )}

                    {/* Size */}
                    {size && (
                        <tr className="hover:bg-gray-800/50 transition-colors">
                            <td className="py-3 px-4 align-top">
                                <span className="text-sky-400 font-semibold">Size</span>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                                <GlossaryContentRenderer
                                    markdownContent={size.value}
                                    onNavigate={onNavigate}
                                />
                            </td>
                        </tr>
                    )}

                    {/* Speed */}
                    {speed && (
                        <tr className="hover:bg-gray-800/50 transition-colors">
                            <td className="py-3 px-4 align-top">
                                <span className="text-sky-400 font-semibold">Speed</span>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                                <GlossaryContentRenderer
                                    markdownContent={speed.value}
                                    onNavigate={onNavigate}
                                />
                            </td>
                        </tr>
                    )}

                    {/* Vision (always shown) */}
                    <tr className="hover:bg-gray-800/50 transition-colors group">
                        <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2">
                                <div className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400 group-hover:scale-110 transition-transform">
                                    <GlossaryIcon name={visionIcon} className="w-4 h-4" />
                                </div>
                                <span className="text-sky-400 font-semibold">Vision</span>
                            </div>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                            {visionText}
                            {darkvisionTrait && (
                                <div className="text-xs text-gray-400 mt-1">
                                    <GlossaryContentRenderer
                                        markdownContent={darkvisionTrait.description}
                                        onNavigate={onNavigate}
                                    />
                                </div>
                            )}
                        </td>
                    </tr>

                    {/* All other racial traits */}
                    {otherTraits.map((trait, index) => (
                        <tr key={index} className="hover:bg-gray-800/50 transition-colors group">
                            <td className="py-3 px-4 align-top">
                                <div className="flex items-center gap-2">
                                    <div className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400 group-hover:scale-110 transition-transform">
                                        <GlossaryIcon name={trait.icon} className="w-4 h-4" />
                                    </div>
                                    <span className="text-sky-400 font-semibold">{trait.name}</span>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
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
