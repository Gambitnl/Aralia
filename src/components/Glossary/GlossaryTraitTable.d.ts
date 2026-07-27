import React from 'react';
interface Trait {
    name: string;
    icon: string;
    description: string;
}
interface Characteristic {
    label: string;
    value: string;
}
interface GlossaryTraitTableProps {
    traits: Trait[];
    characteristics?: Characteristic[];
    onNavigate?: (termId: string) => void;
}
export declare const VALID_ICONS: Set<string>;
/**
 * Renders a unified table of characteristics and traits in spell progression style.
 * Combines base stats (Creature Type, Size, Speed, Darkvision) with racial traits.
 * Features icon integration and structured text rendering.
 */
export declare const GlossaryTraitTable: React.FC<GlossaryTraitTableProps>;
export {};
