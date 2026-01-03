import React from 'react';
import { GlossaryEntry } from '../../types';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';

interface GlossaryEntryTemplateProps {
    entry: GlossaryEntry | null;
    markdownContent: string | null;
    onNavigate?: (termId: string) => void;
}

/**
 * A standardized template for displaying non-spell glossary entries.
 * mimic's the visual style of SpellCardTemplate for consistency.
 */
export const GlossaryEntryTemplate: React.FC<GlossaryEntryTemplateProps> = ({ 
    entry, 
    markdownContent, 
    onNavigate 
}) => {
    if (!entry) return null;

    const hasExtraInfo = (entry.tags && entry.tags.length > 0) || 
                        (entry.aliases && entry.aliases.length > 0) || 
                        (entry.seeAlso && entry.seeAlso.length > 0);

    return (
        <div className="glossary-card">
            {/* Header Section matching SpellCardTemplate */}
            <div className="spell-card-header">
                <h1 className="spell-card-title">{entry.title}</h1>
            </div>

            <div className="spell-card-divider"></div>

            {/* Main Content */}
            <div className="prose prose-sm prose-invert max-w-none text-gray-300 leading-relaxed prose-headings:text-amber-300 prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-strong:text-sky-300 prose-a:text-sky-400 hover:prose-a:text-sky-300 prose-blockquote:border-l-sky-500 prose-table:border-gray-600 prose-th:bg-gray-700 prose-th:border-gray-600 prose-td:border-gray-600">
                <GlossaryContentRenderer markdownContent={markdownContent || ''} onNavigate={onNavigate} />
            </div>

            {/* Footer Metadata Section */}
            {hasExtraInfo && (
                <div className="mt-6 pt-4 border-t border-gray-600/50 text-xs space-y-2">
                    {entry.tags && entry.tags.length > 0 && (
                        <p><strong className="text-sky-300">Tags:</strong> <span className="text-gray-400">{entry.tags.join(', ')}</span></p>
                    )}
                    {entry.aliases && entry.aliases.length > 0 && (
                        <p><strong className="text-sky-300">Aliases:</strong> <span className="text-gray-400">{entry.aliases.join(', ')}</span></p>
                    )}
                    {entry.seeAlso && entry.seeAlso.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sky-300 flex-shrink-0">See Also:</strong>
                            <div className="flex flex-wrap gap-1.5">
                                {entry.seeAlso.map(termId => (
                                    <button key={termId} onClick={() => onNavigate?.(termId)}
                                        className="text-sky-400 hover:text-sky-200 hover:bg-sky-800/50 bg-sky-900/50 px-2 py-0.5 rounded-md text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400">
                                        {termId.replace(/_/g, ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
