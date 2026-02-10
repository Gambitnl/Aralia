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
import { VALID_TRAIT_ICONS } from '../../utils/traits/validTraitIcons';
import { getTraitIcon } from '../../utils/traits/traitIcons';

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

// Back-compat export name for any downstream imports (none found currently).
export const VALID_ICONS = VALID_TRAIT_ICONS;

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

        // Find primary vision trait (standardized to 'Vision', or legacy 'Darkvision')
        const primaryVisionTrait = traits.find(t => t.name === 'Vision' || t.name === 'Darkvision' || t.name === 'Superior Darkvision');
        
        // Find special vision traits (excluding the primary one)
        const specialVisionTraits = traits.filter(t => 
            t !== primaryVisionTrait && (
                t.name.toLowerCase().includes('vision') ||
                t.name === 'Tremorsense' ||
                t.name === 'Blindsight' ||
                t.name === 'Truesight'
            )
        );
    
        // Determine vision text and description
        let visionText = 'Normal';
        let visionDescription: string | null = null;
        let visionIcon = 'eye';
    
        if (primaryVisionTrait) {
            visionIcon = primaryVisionTrait.icon || 'eye';
            
            // Use the trait name + range for the header if we can find a range
            const rangeMatch = primaryVisionTrait.description.match(/(\d+)\s*feet/);
            const range = rangeMatch ? ` (${rangeMatch[1]} feet)` : '';
            
            // If it's the standardized "Vision" trait, we determine the label based on the range
            if (primaryVisionTrait.name === 'Vision') {
                const isSuperior = primaryVisionTrait.description.toLowerCase().includes('superior');
                visionText = isSuperior ? 'Superior Darkvision' : 'Standard Darkvision';
            } else {
                visionText = primaryVisionTrait.name;
            }
            
            if (range) visionText += range;
            
            visionDescription = primaryVisionTrait.description;
        } else if (specialVisionTraits.length > 0) {
            const specialVision = specialVisionTraits[0];
            const rangeMatch = specialVision.description.match(/(\d+)\s*feet/);
            const range = rangeMatch ? ` (${rangeMatch[1]} feet)` : '';
            visionText = `${specialVision.name}${range}`;
            visionDescription = specialVision.description;
        }
    
        // Get all other traits
        const otherTraits = traits.filter(t => 
            t !== primaryVisionTrait && 
            !specialVisionTraits.includes(t)
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
                            {visionDescription && (
                                <div className="text-xs text-gray-400 mt-1">
                                    <GlossaryContentRenderer
                                        markdownContent={visionDescription}
                                        onNavigate={onNavigate}
                                    />
                                </div>
                            )}
                        </TableCell>
                    </TableRow>

                    {/* All other racial traits */}
                    {otherTraits.map((trait, index) => {
                        const iconName = getTraitIcon(trait.name, trait.icon);
                        const isFallback = iconName === 'auto_awesome';

                        return (
                            <TableRow key={index}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className={`flex-shrink-0 p-1 rounded group-hover:scale-110 transition-transform ${isFallback
                                            ? "bg-red-900/30 text-red-500"
                                            : "bg-sky-900/30 text-sky-400"
                                            }`}>
                                            <GlossaryIcon name={iconName} className="w-4 h-4" />
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
                        );
                    })}
                </TableBody>
            </Table>
            <div className="px-4 py-2 border-t border-gray-700/50 bg-gray-900/20 text-[10px] text-gray-500 flex justify-end">
                <span>Icons from the <span className="text-sky-400/80">Curated Library</span></span>
            </div>
        </TableContainer>
    );
};
