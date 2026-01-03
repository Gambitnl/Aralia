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
}

/**
 * Wraps the application in global context providers.
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <GlossaryProvider>
            <SpellProvider>
                <DiceProvider>
                    {children}
                </DiceProvider>
            </SpellProvider>
        </GlossaryProvider>
    );
};
