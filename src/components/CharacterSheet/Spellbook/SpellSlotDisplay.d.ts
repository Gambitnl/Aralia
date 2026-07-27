/**
 * @file SpellSlotDisplay.tsx
 * Compact spell slot visualization for the spellbook header.
 */
import React from 'react';
import { SpellSlots } from '../../../types';
interface SpellSlotDisplayProps {
    spellSlots: SpellSlots | undefined;
}
declare const SpellSlotDisplay: React.FC<SpellSlotDisplayProps>;
export default SpellSlotDisplay;
