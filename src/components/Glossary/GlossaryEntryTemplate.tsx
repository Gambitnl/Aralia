import React, { useState } from 'react';
import { GlossaryTraitTable } from './GlossaryTraitTable';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';
import ImageModal from '../ImageModal';
import { GlossaryEntry } from '../../types';

/**
 * Helper to resolve image URLs for Vite deployments.
 * Prepends the BASE_URL environment variable for local asset paths.
 * This ensures images work correctly when the app is deployed to a subdirectory.
 * 
 * @param url - The image URL (can be relative or absolute)
 * @returns The resolved URL with proper base path, or undefined if no URL provided
 */
const resolveImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    // If already absolute URL (external), use as-is
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // For local asset paths, prepend the Vite base URL to handle subdirectory deployments
    const baseUrl = import.meta.env.BASE_URL || '/';
    return `${baseUrl}${url.startsWith('/') ? url.slice(1) : url}`;
};

interface GlossaryEntryTemplateProps {
    entry: GlossaryEntry | null;
    markdownContent: string | null;
    onNavigate?: (termId: string) => void;
}

/**
 * A standardized template for displaying non-spell glossary entries.
 * Supports both legacy markdownContent and new structured data fields.
 */
export const GlossaryEntryTemplate: React.FC<GlossaryEntryTemplateProps> = ({
    entry,
    markdownContent,
    onNavigate
}) => {
    /**
     * State for the expanded image modal (lightbox).
     * When set, the ImageModal displays a full-size version of the clicked image.
     * Null means no image is expanded.
     */
    const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);

    if (!entry) return null;

    const hasExtraInfo = (entry.tags && entry.tags.length > 0) ||
        (entry.aliases && entry.aliases.length > 0) ||
        (entry.seeAlso && entry.seeAlso.length > 0) ||
        entry.source;

    /**
     * Dual Image Gallery Logic:
     * - hasDualImages: True if either maleImageUrl or femaleImageUrl is present
     *   (new format for race entries with male/female portraits)
     * - hasLegacyImage: True if only the old single imageUrl format is used
     *   (fallback for entries not yet migrated to dual images)
     */
    const hasDualImages = entry.maleImageUrl || entry.femaleImageUrl;
    const hasLegacyImage = entry.imageUrl && !hasDualImages;

    return (
        <>
            <div className="glossary-card">
                {/* Header Section matching SpellCardTemplate */}
                <div className="spell-card-header">
                    <h1 className="spell-card-title">{entry.title}</h1>
                </div>

                <div className="spell-card-divider"></div>

                {/* Main Content Area */}
                <div className="space-y-6">
                    {/* Image Section - Dual or Legacy */}
                    {hasDualImages ? (
                        /* Male/Female dual image layout */
                        <div className="flex gap-3 justify-center mb-6">
                            {/* Male Image */}
                            <div className="w-28 sm:w-32">
                                {entry.maleImageUrl ? (
                                    <button
                                        type="button"
                                        className="relative group cursor-zoom-in w-full"
                                        onClick={() => setExpandedImage({ src: resolveImageUrl(entry.maleImageUrl)!, alt: `${entry.title} male` })}
                                        aria-label={`Expand ${entry.title} male image`}
                                    >
                                        <img
                                            src={resolveImageUrl(entry.maleImageUrl)}
                                            alt={`${entry.title} male`}
                                            className="w-full h-auto rounded-lg shadow-lg border border-gray-600 group-hover:border-sky-500 transition-colors"
                                        />
                                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-black/70 px-2 py-0.5 rounded text-gray-300">Male</span>
                                    </button>
                                ) : (
                                    <div className="w-full aspect-[3/4] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 border border-gray-600 text-sm">
                                        Male
                                    </div>
                                )}
                            </div>
                            {/* Female Image */}
                            <div className="w-28 sm:w-32">
                                {entry.femaleImageUrl ? (
                                    <button
                                        type="button"
                                        className="relative group cursor-zoom-in w-full"
                                        onClick={() => setExpandedImage({ src: resolveImageUrl(entry.femaleImageUrl)!, alt: `${entry.title} female` })}
                                        aria-label={`Expand ${entry.title} female image`}
                                    >
                                        <img
                                            src={resolveImageUrl(entry.femaleImageUrl)}
                                            alt={`${entry.title} female`}
                                            className="w-full h-auto rounded-lg shadow-lg border border-gray-600 group-hover:border-sky-500 transition-colors"
                                        />
                                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-black/70 px-2 py-0.5 rounded text-gray-300">Female</span>
                                    </button>
                                ) : (
                                    <div className="w-full aspect-[3/4] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 border border-gray-600 text-sm">
                                        Female
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : hasLegacyImage ? (
                        /* Legacy single image layout */
                        <div className="w-full h-48 sm:h-64 rounded-lg overflow-hidden border border-gray-600 shadow-inner mb-6 relative group">
                            <img
                                src={resolveImageUrl(entry.imageUrl)}
                                alt={entry.title}
                                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent pointer-events-none"></div>
                        </div>
                    ) : null}

                    {/* Lore / Introductory Text (New or Legacy) */}
                    {(entry.entryLore || (!entry.characteristics && markdownContent)) && (
                        <div className="prose prose-sm prose-invert max-w-none text-gray-300 leading-relaxed prose-headings:text-amber-300 prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-strong:text-sky-300 prose-a:text-sky-400 hover:prose-a:text-sky-300 prose-blockquote:border-l-sky-500">
                            <GlossaryContentRenderer
                                markdownContent={entry.entryLore || markdownContent || ''}
                                onNavigate={onNavigate}
                            />
                        </div>
                    )}

                    {/* Unified Traits Table (combines characteristics and traits) */}
                    {entry.traits && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                                Racial Traits
                            </h3>
                            <GlossaryTraitTable
                                traits={entry.traits}
                                characteristics={entry.characteristics}
                                onNavigate={onNavigate}
                            />
                        </div>
                    )}

                    {/* Additional Markdown Content (Bottom Fallback) - Only show if entryLore was used above */}
                    {entry.entryLore && markdownContent && (
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

            {/* Image Modal */}
            {expandedImage && (
                <ImageModal src={expandedImage.src} alt={expandedImage.alt} onClose={() => setExpandedImage(null)} />
            )}
        </>
    );
};
