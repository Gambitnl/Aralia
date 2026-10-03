import React from 'react';
import { Spell } from '../../../types';
interface SpellCardProps {
    spell: Spell;
    selected: boolean;
    disabled: boolean;
    onToggle: () => void;
    idPrefix?: string;
    className?: string;
}
/**
 * Class spell selection keeps its historical checkbox API while delegating the
 * visible spell summary to the shared card used by feat and spellbook surfaces.
 */
export declare const SpellCard: React.FC<SpellCardProps>;
export {};
