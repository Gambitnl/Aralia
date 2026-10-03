/**
 * ARCHITECTURAL CONTEXT:
 * This component handles the 'Detailed Class View' in the split-pane
 * character creation UI. It acts as the primary informational surface
 * when a player is deciding between different character classes.
 *
 * Recent updates focus on 'Visual Identity' and 'Systematic Icons'.
 * - Integrated `getClassIcon` and `GlossaryIcon`. The component now
 *   automatically pulls the standardized class icon (e.g., a shield for
 *   Fighter, a flame for Sorcerer) to enhance brand consistency and
 *   provide immediate visual recognition.
 * - Refined the layout to include specialized containers for 'Armor &
 *   Weapons' proficiencies, providing a cleaner breakdown of combat
 *   capabilities.
 *
 * @file src/components/CharacterCreator/Class/ClassDetailPane.tsx
 */
import React from 'react';
import { Class as CharClass } from '../../../types';
interface ClassDetailPaneProps {
    charClass: CharClass;
    onSelect: (classId: string) => void;
}
export declare const ClassDetailPane: React.FC<ClassDetailPaneProps>;
export {};
