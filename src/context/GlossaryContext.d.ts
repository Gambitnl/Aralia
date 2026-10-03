/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 31/05/2026, 23:09:13
 * Dependents: components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/DesignPreview/steps/GlossaryRedirectSurfacesPanel.tsx, components/DesignPreview/steps/PreviewGlossaryRedirectSurfaces.tsx, components/DesignPreview/steps/PreviewSpellGlossary.tsx, components/Glossary/Glossary.tsx, components/Glossary/GlossaryContentRenderer.tsx, components/Glossary/GlossaryTooltip.tsx, components/Glossary/SingleGlossaryEntryModal.tsx, components/WorldPane.tsx, components/providers/AppProviders.tsx, components/providers/DataLoaderGate.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React, { ReactNode } from "react";
import { GlossaryEntry } from '../types';
declare const GlossaryContext: React.Context<GlossaryEntry[]>;
interface GlossaryProviderProps {
    children: ReactNode;
    /** Defers the glossary search bundle until the glossary or game shell needs it. */
    enabled?: boolean;
}
export declare const GlossaryProvider: React.FC<GlossaryProviderProps>;
export default GlossaryContext;
