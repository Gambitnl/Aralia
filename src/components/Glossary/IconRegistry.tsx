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

// C11 (agora-9ed9.11): the icon-name union moved to types/glossaryIconName so
// utils (classIcons) can name icons without importing this component module.
// It stays exported from here for the existing component callers.
import type { GlossaryIconName } from '../../types/glossaryIconName';
export type { GlossaryIconName } from '../../types/glossaryIconName';

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
