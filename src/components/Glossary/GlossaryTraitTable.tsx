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

// List of valid icon names to validate against
// This avoids rendering broken icons or just raw text when the icon name is invalid
export const VALID_ICONS = new Set([
    'eye', 'heart', 'shield', 'sword', 'wind', 'flame', 'water', 'mountain', 'stars', 'skull',
    'sun', 'moon', 'magic', 'feather', 'claw', 'brain', 'lightbulb', 'clock', 'book',
    'flask', 'gavel', 'music', 'pray', 'leaf', 'fist', 'crosshairs', 'mask', 'wizard_hat',
    'build', 'hardware', 'auto_awesome', 'spa', 'security', 'martial_arts', 'verified_user',
    'fa_flask', 'fa_gavel', 'fa_music', 'fa_hands_praying', 'fa_leaf', 'fa_shield_halved',
    'fa_hand_fist', 'fa_sun', 'fa_crosshairs', 'fa_mask', 'fa_fire', 'fa_skull', 'fa_hat_wizard',
    'fa_eye', 'fa_lightbulb', 'fa_brain', 'fa_book', 'fa_feather',
    'sword_cross', 'axe', 'mace', 'eye_mdi', 'lightbulb_mdi', 'brain_mdi', 'book_mdi',
    'feather_mdi', 'claw_mdi', 'bow_arrow', 'axe_battle', 'pickaxe', 'fencing', 'spear',
    'shield_sun', 'shield_sun_outline', 'shield_sword', 'shield_sword_outline',
    'shield_cross', 'shield_cross_outline', 'shield_crown', 'shield_crown_outline',
    'shield_moon', 'shield_moon_outline', 'shield_star', 'shield_star_outline',
    'magic_staff', 'wizard_hat_mdi', 'bottle_tonic_skull', 'bottle_tonic_skull_outline',
    'skull_mdi', 'skull_outline_mdi', 'skull_crossbones', 'skull_crossbones_outline',
    'weather_hail', 'weather_hazy', 'weather_lightning', 'weather_lightning_rainy',
    'weather_pouring', 'weather_cloudy', 'weather_rainy', 'weather_sunny', 'weather_fog',
    'weather_snowy', 'weather_snowy_heavy', 'weather_snowy_rainy',
    'tree', 'tree_outline',
    'dice_d4', 'dice_d4_outline', 'dice_d6', 'dice_d6_outline', 'dice_d8', 'dice_d8_outline',
    'dice_d10', 'dice_d10_outline', 'dice_d12', 'dice_d12_outline', 'dice_d20', 'dice_d20_outline',
    'horse', 'horse_variant', 'horse_variant_fast', 'fish',
    'paw', 'paw_outline', 'paw_off', 'paw_off_outline', 'spider',
    'clover', 'clover_outline', 'horseshoe', 'emoticon_sick', 'emoticon_sick_outline',
    'emoticon_kiss', 'emoticon_kiss_outline', 'emoticon_devil', 'emoticon_devil_outline',
    'flower', 'flower_outline'
]);

/**
 * Maps common trait names or concepts to curated icons.
 * Fallbacks to a default 'sparkle' or similar if no match found.
 */
export const getTraitIcon = (name: string, defaultIcon?: string): string => {
    const n = name.toLowerCase();

    // Explicit mappings for the example/common traits
    if (n.includes('lucky') || n.includes('luck')) return 'clover';
    if (n.includes('brave') || n.includes('courage')) return 'shield_star';
    if (n.includes('nimble') || n.includes('speed') || n.includes('agility')) return 'wind';
    if (n.includes('resilience') || n.includes('tough')) return 'shield';
    if (n.includes('magic') || n.includes('spell')) return 'magic';
    if (n.includes('attack') || n.includes('combat')) return 'sword';
    if (n.includes('skill') || n.includes('expert')) return 'book';
    if (n.includes('vision') || n.includes('sight')) return 'eye';

    // Check if defaultIcon is valid
    if (defaultIcon && VALID_ICONS.has(defaultIcon)) {
        return defaultIcon;
    }

    // Check if name itself matches an icon (case insensitive)
    const exactMatch = Array.from(VALID_ICONS).find(icon => icon.toLowerCase() === n);
    if (exactMatch) return exactMatch;

    return 'auto_awesome'; // Default generic trait icon (sparkles)
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
