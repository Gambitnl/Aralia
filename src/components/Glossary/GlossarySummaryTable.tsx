import React from 'react';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../ui/Table';

interface Characteristic {
    label: string;
    value: string;
}

interface GlossarySummaryTableProps {
    characteristics: Characteristic[];
    onNavigate?: (termId: string) => void;
}

/**
 * Renders a summary dashboard of core characteristics for a glossary entry.
 * Uses the premium table style with borders and shadows.
 */
export const GlossarySummaryTable: React.FC<GlossarySummaryTableProps> = ({
    characteristics,
    onNavigate
}) => {
    if (!characteristics || characteristics.length === 0) return null;

    return (
        <TableContainer className="mb-8">
            <Table>
                <TableHeader>
                    <TableRow>
                        {characteristics.map((char, index) => (
                            <TableHead
                                key={index}
                                className="border-r border-gray-600 last:border-r-0"
                            >
                                {char.label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        {characteristics.map((char, index) => (
                            <TableCell
                                key={index}
                                className="border-r border-gray-600 last:border-r-0 align-top"
                            >
                                <GlossaryContentRenderer
                                    markdownContent={char.value}
                                    onNavigate={onNavigate}
                                />
                            </TableCell>
                        ))}
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>
    );
};
