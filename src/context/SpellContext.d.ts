/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 31/05/2026, 23:09:13
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/FeatSelection.tsx, components/CharacterCreator/FeatSpellPicker.tsx, components/CharacterCreator/NameAndReview.tsx, components/CharacterCreator/Race/GnomeSubraceSelection.tsx, components/CharacterCreator/Race/TieflingLegacySelection.tsx, components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/CharacterSheet/Spellbook/SpellbookTab.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/providers/AppProviders.tsx, components/providers/DataLoaderGate.tsx, utils/character/spellFilterUtils.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React, { ReactNode } from 'react';
import { Spell } from '../types';
export type SpellDataRecord = Record<string, Spell>;
declare const SpellContext: React.Context<SpellDataRecord>;
interface SpellProviderProps {
    children: ReactNode;
    /** Defers the 4 MB spell bundle until a spell-aware screen is actually open. */
    enabled?: boolean;
}
export declare const SpellProvider: React.FC<SpellProviderProps>;
export default SpellContext;
