/**
 * @file GlossaryDisplay.tsx
 * This component displays a list of icons and their meanings,
 * typically used for map legends or submap glossaries.
 */
import React from 'react';
import { GlossaryDisplayItem } from '../../types';
interface GlossaryDisplayProps {
    items: GlossaryDisplayItem[];
    title?: string;
}
declare const GlossaryDisplay: React.FC<GlossaryDisplayProps>;
export default GlossaryDisplay;
