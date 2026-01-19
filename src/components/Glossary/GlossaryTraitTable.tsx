import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableHeader,
    TableRow,
} from '../ui/Table';
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
 * Maps common trait names or concepts to curated icons.
 * Fallbacks to a default 'sparkle' or similar if no match found.
 */
const getTraitIcon = (name: string, defaultIcon?: string): string => {
    const n = name.toLowerCase();

    // Explicit mappings for the example/common traits
    if (n.includes('lucky') || n.includes('luck')) return 'clover';
    if (n.includes('brave') || n.includes('courage')) return 'shield_star'; // or 'shield'
    if (n.includes('nimble') || n.includes('speed') || n.includes('agility')) return 'wind'; // 'wind' or 'feather' or 'mid_paw'

    // Fallback to the provided icon if it's already a valid key (not an emoji)
    // The current data uses emojis like 🍀, 🛡️, 🏃. We need to detect if it's an emoji and replace it 
    // or if it's a key. Assuming the incoming 'icon' prop might still be an emoji from old data.
    // However, the interface says 'icon: string'.

    // Use the logic: if we have a specific mapping, use it. 
    // If the 'defaultIcon' looks like a valid registry key (simple text), use it.
    // If it looks like an emoji (non-ascii), use a generic fallback.

    if (defaultIcon && /^[a-z0-9_]+$/i.test(defaultIcon)) {
        return defaultIcon;
    }

    return 'sparkle'; // Default generic trait icon
};

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
    // Determine vision text
    let visionText = 'Normal';
    // Use 'eye' for normal/darkvision, or potentially 'eye_mdi' / 'fa_eye' if preferred. 
    // 'eye' is the standard concept key.
    let visionIcon = 'eye';

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
        <TableContainer>
            <Table>
                <TableHeader>
                    <TableRow className="border-b border-gray-600">
                        <TableHead>Trait</TableHead>
                        <TableHead>Description</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {/* Creature Type */}
                    {creatureType && (
                        <TableRow>
                            <TableCell>
                                <span className="text-sky-400 font-semibold">Creature Type</span>
                            </TableCell>
                            <TableCell>
                                <GlossaryContentRenderer
                                    markdownContent={creatureType.value}
                                    onNavigate={onNavigate}
                                />
                            </TableCell>
                        </TableRow>
                    )}

                    {/* Size */}
                    {size && (
                        <TableRow>
                            <TableCell>
                                <span className="text-sky-400 font-semibold">Size</span>
                            </TableCell>
                            <TableCell>
                                <GlossaryContentRenderer
                                    markdownContent={size.value}
                                    onNavigate={onNavigate}
                                />
                            </TableCell>
                        </TableRow>
                    )}

                    {/* Speed */}
                    {speed && (
                        <TableRow>
                            <TableCell>
                                <span className="text-sky-400 font-semibold">Speed</span>
                            </TableCell>
                            <TableCell>
                                <GlossaryContentRenderer
                                    markdownContent={speed.value}
                                    onNavigate={onNavigate}
                                />
                            </TableCell>
                        </TableRow>
                    )}

                    {/* Vision (always shown) */}
                    <TableRow>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <div className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400 group-hover:scale-110 transition-transform">
                                    <GlossaryIcon name={visionIcon} className="w-4 h-4 text-sky-400/80" />
                                </div>
                                <span className="text-sky-400 font-semibold">Vision</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            {visionText}
                            {darkvisionTrait && (
                                <div className="text-xs text-gray-400 mt-1">
                                    <GlossaryContentRenderer
                                        markdownContent={darkvisionTrait.description}
                                        onNavigate={onNavigate}
                                    />
                                </div>
                            )}
                        </TableCell>
                    </TableRow>

                    {/* All other racial traits */}
                    {otherTraits.map((trait, index) => (
                        <TableRow key={index}>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <div className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400 group-hover:scale-110 transition-transform">
                                        <GlossaryIcon name={getTraitIcon(trait.name, trait.icon)} className="w-4 h-4" />
                                    </div>
                                    <span className="text-sky-400 font-semibold">{trait.name}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <GlossaryContentRenderer
                                    markdownContent={trait.description}
                                    onNavigate={onNavigate}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="px-4 py-2 border-t border-gray-700/50 bg-gray-900/20 text-[10px] text-gray-500 flex justify-end">
                <span>Icons from the <span className="text-sky-400/80">Curated Library</span></span>
            </div>
        </TableContainer>
    );
};
