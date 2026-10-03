/**
 * @file SpellDetailPane.tsx
 * Displays detailed spell information using SpellContext data.
 * Designed to match the glossary entry style.
 */
import React from 'react';
import { Spell } from '../../../types';
interface SpellDetailPaneProps {
    spell: Spell;
}
declare const SpellDetailPane: React.FC<SpellDetailPaneProps>;
export default SpellDetailPane;
