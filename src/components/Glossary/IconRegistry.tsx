// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:21:17
 * Dependents: components/CharacterCreator/Race/RaceDetailPane.tsx, components/CharacterCreator/shared/CharacterCreatorTraitsTable.tsx, components/DesignPreview/steps/PreviewIcons.tsx, components/DesignPreview/steps/PreviewMissingIcons.tsx, components/DesignPreview/steps/PreviewTables.tsx, components/Glossary/ArtificerInfusionsTable.tsx, components/Glossary/GlossaryTraitTable.tsx, components/Party/PartyOverlay.tsx, components/Party/PartyPane/PartyMemberCard.tsx, utils/classIcons.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { iconSetCreaturesElements } from './icons/iconSetCreaturesElements';
import { iconSetGearCombat } from './icons/iconSetGearCombat';
import { iconSetMagicStatus } from './icons/iconSetMagicStatus';
import { iconSetMisc } from './icons/iconSetMisc';

/**
 * This file acts as a centralized library of visual icons used throughout the game's interface.
 *
 * It maps simple names (like 'sword' or 'shield') to their corresponding vector graphic (SVG) shapes.
 * This allows other components to draw icons consistently and prevents duplicate graphic definitions.
 *
 * Called by: Various user interface files (such as ClassDetailPane, PartyMemberCard, and glossary tables).
 * Depends on: React for rendering the SVG elements.
 */

export type GlossaryIconName =
    | 'eye'
    | 'heart'
    | 'shield'
    | 'sword'
    | 'wind'
    | 'flame'
    | 'water'
    | 'mountain'
    | 'stars'
    | 'skull'
    | 'sun'
    | 'moon'
    | 'mountain_lucide'
    | 'magic'
    | 'feather'
    | 'claw'
    | 'brain'
    | 'lightbulb'
    | 'clock'
    | 'book'
    // Class icons (custom)
    | 'flask'
    | 'gavel'
    | 'music'
    | 'pray'
    | 'leaf'
    | 'fist'
    | 'crosshairs'
    | 'mask'
    | 'wizard_hat'
    // Material Icons
    | 'build'
    | 'hardware'
    | 'auto_awesome'
    | 'auto_awesome_mdi'
    | 'creation'
    | 'spa'
    | 'spa_mdi'
    | 'sprout'
    | 'summit'
    | 'security'
    | 'martial_arts'
    | 'verified_user'
    // Font Awesome Icons (official class icons)
    | 'fa_flask'
    | 'fa_gavel'
    | 'fa_music'
    | 'fa_hands_praying'
    | 'fa_leaf'
    | 'fa_shield_halved'
    | 'fa_hand_fist'
    | 'fa_sun'
    | 'fa_crosshairs'
    | 'fa_mask'
    | 'fa_fire'
    | 'fa_skull'
    | 'fa_hat_wizard'
    | 'fa_eye'
    | 'fa_lightbulb'
    | 'fa_brain'
    | 'fa_book'
    | 'fa_feather'
    // Pictogrammers/MDI Icons
    | 'sword_cross'
    | 'axe'
    | 'mace'
    | 'eye_mdi'
    | 'lightbulb_mdi'
    | 'brain_mdi'
    | 'book_mdi'
    | 'feather_mdi'
    | 'claw_mdi'
    | 'flask_mdi'
    | 'ring'
    | 'hammer'
    | 'package'
    // MDI Weapons
    | 'bow_arrow' | 'axe_battle' | 'pickaxe' | 'fencing' | 'spear'
    // MDI Shields
    | 'shield_sun' | 'shield_sun_outline'
    | 'shield_sword' | 'shield_sword_outline'
    | 'shield_cross' | 'shield_cross_outline'
    | 'shield_crown' | 'shield_crown_outline'
    | 'shield_moon' | 'shield_moon_outline'
    | 'shield_star' | 'shield_star_outline'
    // MDI Magic & Death
    | 'magic_staff' | 'wizard_hat_mdi'
    | 'bottle_tonic_skull' | 'bottle_tonic_skull_outline'
    | 'skull_mdi' | 'skull_outline_mdi'
    | 'skull_crossbones' | 'skull_crossbones_outline'
    // MDI Weather
    | 'weather_hail' | 'weather_hazy' | 'weather_lightning' | 'weather_lightning_rainy'
    | 'weather_pouring' | 'weather_cloudy' | 'weather_rainy' | 'weather_sunny' | 'weather_fog'
    | 'weather_snowy' | 'weather_snowy_heavy' | 'weather_snowy_rainy'
    // MDI Nature
    | 'tree' | 'tree_outline'
    | 'flower' | 'flower_outline'
    // MDI Dice
    | 'dice_d4' | 'dice_d4_outline'
    | 'dice_d6' | 'dice_d6_outline'
    | 'dice_d8' | 'dice_d8_outline'
    | 'dice_d10' | 'dice_d10_outline'
    | 'dice_d12' | 'dice_d12_outline'
    | 'dice_d20' | 'dice_d20_outline'
    // MDI Animals/Creatures
    | 'horse' | 'horse_variant' | 'horse_variant_fast'
    | 'fish'
    | 'paw' | 'paw_outline' | 'paw_off' | 'paw_off_outline' | 'paw_variant'
    | 'spider' | 'spider_outline'
    // MDI Luck & Conditions
    | 'clover' | 'clover_outline' | 'horseshoe'
    | 'emoticon_sick' | 'emoticon_sick_outline'
    | 'emoticon_kiss' | 'emoticon_kiss_outline'
    | 'emoticon_devil' | 'emoticon_devil_outline'
    | 'settings_heart' | 'sparkle' | 'creation' | 'terrain'
    
    | 'eye_off' | 'ear_hearing_off' | 'hand_back_right' | 'wheelchair_accessibility'
    | 'eye_outline' | 'flash_off' | 'account_box_outline' | 'human_prone' | 'speedometer_slow'
    | 'heal'
    | 'light'
    | 'shadow'
    | 'wings'
    | 'fire'
    | 'star'
    | 'crosshair'
    | 'strength'
    | 'hand'
    | 'lightning'
    | 'jump'
    | 'sound'
    | 'calm'
    | 'trunk'
    | 'nose'
    | 'stealth'
    | 'arms'
    | 'telepathy'
    | 'dice'
    | 'wrench'
    | 'cog'
    | 'tools'
    | 'armor'
    | 'crown'
    | 'stone'
    | 'lock'
    | 'sparkle'
    | 'perception'
    | 'teleport'
    | 'snowflake'
    | 'vision'
    | 'psychology'
    | 'quill'
    | 'fitness_center'
    | 'expand'
    | 'gift'
    | 'speech'
    | 'target'
    | 'speed'
    | 'nature'
    | 'home'
    | 'beast'
    | 'protect'
    | 'compass'
    | 'mind'
    | 'dna'
    | 'evolution'
    | 'transform'
    | 'fangs'
    | 'blob'
    | 'lungs';

interface GlossaryIconProps {
    name: GlossaryIconName | string;
    className?: string;
}

/**
 * A centralized registry of SVG icons for the glossary.
 * This component maps simple string IDs to complex SVG paths.
 */
export const GlossaryIcon: React.FC<GlossaryIconProps> = ({ name, className = "w-4 h-4" }) => {
    const icons: Record<string, React.ReactNode> = {
        // Icon data was moved into four sibling modules (MOD-3.1). The entries are
        // spread back together here, so lookup, the .svg passthrough, and the
        // Material Symbols fallback below all behave exactly as before. The four
        // sets have no overlapping keys, so merge order does not change any lookup.
        ...iconSetCreaturesElements(className),
        ...iconSetGearCombat(className),
        ...iconSetMagicStatus(className),
        ...iconSetMisc(className),
    };

    if (typeof name === 'string' && name.endsWith('.svg')) {
        return <img src={name} className={className} alt="" />;
    }

    return icons[name] || (
        // Fallback to Material Symbols Outlined font for icons not in SVG registry
        // Uses the icon name directly as the text content (e.g., "visibility", "shield", "swords")
        <span
            className={`material-symbols-outlined ${className}`}
            style={{
                fontSize: 'inherit',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {name}
        </span>
    );
};
