import { GlossarySummaryTable } from './GlossarySummaryTable';
import { GlossaryTraitTable } from './GlossaryTraitTable';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';

interface GlossaryEntryTemplateProps {
    entry: GlossaryEntry | null;
    markdownContent: string | null;
    onNavigate?: (termId: string) => void;
}

/**
 * A standardized template for displaying non-spell glossary entries.
 * supports both legacy markdownContent and new structured data fields.
 */
export const GlossaryEntryTemplate: React.FC<GlossaryEntryTemplateProps> = ({
    entry,
    markdownContent,
    onNavigate
}) => {
    if (!entry) return null;

    const hasExtraInfo = (entry.tags && entry.tags.length > 0) ||
        (entry.aliases && entry.aliases.length > 0) ||
        (entry.seeAlso && entry.seeAlso.length > 0) ||
        entry.source;

    return (
        <div className="glossary-card">
            {/* Header Section matching SpellCardTemplate */}
            <div className="spell-card-header">
                <h1 className="spell-card-title">{entry.title}</h1>
            </div>

            <div className="spell-card-divider"></div>

            {/* Main Content Area */}
            <div className="space-y-6">
                {/* Image Section (New) */}
                {entry.imageUrl && (
                    <div className="w-full h-48 sm:h-64 rounded-lg overflow-hidden border border-gray-600 shadow-inner mb-6 relative group">
                        <img
                            src={entry.imageUrl}
                            alt={entry.title}
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent pointer-events-none"></div>
                    </div>
                )}

                {/* Lore / Introductory Text (New or Legacy) */}
                {(entry.entryLore || (!entry.characteristics && markdownContent)) && (
                    <div className="prose prose-sm prose-invert max-w-none text-gray-300 leading-relaxed prose-headings:text-amber-300 prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-strong:text-sky-300 prose-a:text-sky-400 hover:prose-a:text-sky-300 prose-blockquote:border-l-sky-500">
                        <GlossaryContentRenderer
                            markdownContent={entry.entryLore || markdownContent || ''}
                            onNavigate={onNavigate}
                        />
                    </div>
                )}

                {/* Characteristics Dashboard (New) */}
                {entry.characteristics && (
                    <GlossarySummaryTable
                        characteristics={entry.characteristics}
                        onNavigate={onNavigate}
                    />
                )}

                {/* Traits Table (New) */}
                {entry.traits && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                            Racial Traits
                        </h3>
                        <GlossaryTraitTable
                            traits={entry.traits}
                            onNavigate={onNavigate}
                        />
                    </div>
                )}

                {/* Additional Markdown Content (Bottom Fallback) */}
                {markdownContent && (
                    <div className="prose prose-sm prose-invert max-w-none text-gray-300 leading-relaxed border-t border-gray-700/30 pt-4 mt-6">
                        <GlossaryContentRenderer markdownContent={markdownContent} onNavigate={onNavigate} />
                    </div>
                )}
            </div>

            {/* Footer Metadata Section */}
            {hasExtraInfo && (
                <div className="mt-8 pt-4 border-t border-gray-600/50 text-xs space-y-2">
                    {entry.source && (
                        <p><strong className="text-sky-300/80">Source:</strong> <span className="text-gray-500">{entry.source}</span></p>
                    )}
                    {entry.tags && entry.tags.length > 0 && (
                        <p><strong className="text-sky-300">Tags:</strong> <span className="text-gray-400">{entry.tags.join(', ')}</span></p>
                    )}
                    {entry.aliases && entry.aliases.length > 0 && (
                        <p><strong className="text-sky-300">Aliases:</strong> <span className="text-gray-400">{entry.aliases.join(', ')}</span></p>
                    )}
                    {entry.seeAlso && entry.seeAlso.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
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
