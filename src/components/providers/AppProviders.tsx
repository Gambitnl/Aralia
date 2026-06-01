/**
 * @file AppProviders.tsx
 * @description
 * This component acts as a central wrapper for all React Context Providers required by the application.
 * By grouping them here, we keep the root `App.tsx` clean and avoid "Provider Hell" indentation in the main component.
 * 
 * Included Providers:
 * - SpellProvider: Manages the state and logic for magic spells and abilities.
 * - DiceProvider: Manages dice rolling functionality with optional 3D visualization.
 */
import React from 'react';
import { GlossaryProvider } from '../../context/GlossaryContext';
import { SpellProvider } from '../../context/SpellContext';
import { DiceProvider } from '../../contexts/DiceContext';

interface AppProvidersProps {
    /** The child components that will have access to the providers. */
    children: React.ReactNode;
    /** Load the glossary bundle only when a screen actually needs rules text or search. */
    loadGlossaryData: boolean;
    /** Load the spell bundle only when gameplay or character creation needs spell records. */
    loadSpellData: boolean;
}

/**
 * Wraps the application in global context providers.
 *
 * The providers stay mounted around the app so context consumers keep their normal
 * shape, but the heavy rule-data fetches are demand-driven. This keeps the main
 * menu lightweight while preserving the existing data path once the player enters
 * gameplay, character creation, or the glossary.
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children, loadGlossaryData, loadSpellData }) => {
    return (
        <GlossaryProvider enabled={loadGlossaryData}>
            <SpellProvider enabled={loadSpellData}>
                <DiceProvider>
                    {children}
                </DiceProvider>
            </SpellProvider>
        </GlossaryProvider>
    );
};
