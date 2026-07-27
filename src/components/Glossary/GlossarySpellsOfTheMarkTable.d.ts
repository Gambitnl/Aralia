import React from 'react';
interface SpellLevel {
    minLevel: number;
    spells: string[];
}
interface GlossarySpellsOfTheMarkTableProps {
    spells: SpellLevel[];
    onNavigate?: (termId: string) => void;
    variant?: 'default' | 'embedded';
}
export declare const GlossarySpellsOfTheMarkTable: React.FC<GlossarySpellsOfTheMarkTableProps>;
export {};
