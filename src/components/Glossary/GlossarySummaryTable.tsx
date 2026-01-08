import React from 'react';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';

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
        <div className="mb-8 overflow-hidden rounded-lg border border-gray-600 shadow-md">
            <table className="min-w-full divide-y divide-gray-600">
                <thead className="bg-gray-700/50">
                    <tr>
                        {characteristics.map((char, index) => (
                            <th
                                key={index}
                                className="px-4 py-3 text-left text-[10px] font-bold text-sky-300 uppercase tracking-tighter border-r border-gray-600 last:border-r-0"
                            >
                                {char.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-gray-800/50">
                    <tr>
                        {characteristics.map((char, index) => (
                            <td
                                key={index}
                                className="px-4 py-4 text-sm font-medium text-gray-200 border-r border-gray-600 last:border-r-0"
                            >
                                <GlossaryContentRenderer
                                    markdownContent={char.value}
                                    onNavigate={onNavigate}
                                />
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
