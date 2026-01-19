import React from 'react';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../ui/Table';

interface SpellLevel {
    minLevel: number;
    spells: string[];
}

interface GlossarySpellsOfTheMarkTableProps {
    spells: SpellLevel[];
    onNavigate?: (termId: string) => void;
    variant?: 'default' | 'embedded';
}

export const GlossarySpellsOfTheMarkTable: React.FC<GlossarySpellsOfTheMarkTableProps> = ({
    spells,
    onNavigate,
    variant = 'default'
}) => {
    if (!spells || spells.length === 0) return null;

    const isEmbedded = variant === 'embedded';

    if (isEmbedded) {
        return (
            <div className="mt-3">
                <Table className="rounded-t-none">
                    <TableHeader>
                        <TableRow className="border-b border-gray-600">
                            <TableHead className="w-24 text-amber-300">Level</TableHead>
                            <TableHead className="text-amber-300">Spells</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {spells.map((level, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-mono text-amber-400/90">
                                    {level.minLevel}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-2 text-gray-300">
                                        {level.spells.map((spell, i) => (
                                            <span key={i}>
                                                <GlossaryContentRenderer
                                                    markdownContent={spell}
                                                    onNavigate={onNavigate}
                                                    className="text-sky-400 hover:text-sky-300 underline"
                                                />
                                                {i < level.spells.length - 1 && <span className="text-gray-600 select-none">, </span>}
                                            </span>
                                        ))}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    return (
        <TableContainer className="mt-4">
            <div className="bg-gray-800/60 px-4 py-2 border-b border-gray-600">
                <h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="border-b border-gray-600">
                        <TableHead className="w-32 text-sky-400">Spell Level</TableHead>
                        <TableHead className="text-sky-400">Spells</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {spells.map((level, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-mono text-gray-400">
                                Level {level.minLevel}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-2 text-gray-300">
                                    {level.spells.map((spell, i) => (
                                        <span key={i}>
                                            <GlossaryContentRenderer
                                                markdownContent={spell}
                                                onNavigate={onNavigate}
                                            />
                                            {i < level.spells.length - 1 && <span className="text-gray-600 select-none">, </span>}
                                        </span>
                                    ))}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};
