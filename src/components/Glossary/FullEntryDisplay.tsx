import React, { useEffect, useState, useCallback } from 'react';
import { GlossaryEntry } from '../../types';
import { GlossaryContentRenderer } from './GlossaryContentRenderer';

const stripYamlFrontmatter = (markdownContent: string): string => {
  const yamlFrontmatterRegex = /^\s*---([\s\S]*?)---(?:\r?\n|\r|$)/;
  const match = markdownContent.match(yamlFrontmatterRegex);
  return match ? markdownContent.substring(match[0].length).trimStart() : markdownContent.trimStart();
};

interface FullEntryDisplayProps {
    entry: GlossaryEntry | null;
    onNavigate?: (termId: string) => void;
}

export const FullEntryDisplay: React.FC<FullEntryDisplayProps> = ({ entry, onNavigate }) => {
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filePath = entry?.filePath;

  useEffect(() => {
    if (!filePath) {
      setLoading(false);
      setError("No file path provided for glossary entry.");
      setMarkdownContent(null);
      return;
    }
    setLoading(true);
    setError(null);
    setMarkdownContent(null);

    fetch(filePath)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch glossary content from ${filePath}: ${res.status} ${res.statusText}`);
        return res.text();
      })
      .then(text => {
        setMarkdownContent(stripYamlFrontmatter(text));
      })
      .catch(err => {
        console.error(`Error fetching ${filePath}:`, err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [filePath]);

  if (loading) return <p className="text-gray-400 italic">Loading full entry...</p>;
  if (error) return <p className="text-red-400">Error loading content: {error}</p>;
  if (!markdownContent && !entry) return <p className="text-gray-500 italic">No content found for this entry.</p>;

  const hasExtraInfo = (entry?.tags && entry.tags.length > 0) || (entry?.aliases && entry.aliases.length > 0) || (entry?.seeAlso && entry.seeAlso.length > 0);

  return (
    <>
      <div className="prose prose-sm prose-invert max-w-none text-gray-300 leading-relaxed prose-headings:text-amber-300 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-strong:text-sky-300 prose-a:text-sky-400 hover:prose-a:text-sky-300 prose-blockquote:border-l-sky-500 prose-table:border-gray-600 prose-th:bg-gray-700 prose-th:border-gray-600 prose-td:border-gray-600">
        <GlossaryContentRenderer markdownContent={markdownContent || ''} onNavigate={onNavigate} />
      </div>
      {hasExtraInfo && (
        <div className="mt-6 pt-4 border-t border-gray-600/50 text-xs space-y-2">
          {entry?.tags && entry.tags.length > 0 && (
            <p><strong className="text-sky-300">Tags:</strong> <span className="text-gray-400">{entry.tags.join(', ')}</span></p>
          )}
          {entry?.aliases && entry.aliases.length > 0 && (
            <p><strong className="text-sky-300">Aliases:</strong> <span className="text-gray-400">{entry.aliases.join(', ')}</span></p>
          )}
          {entry?.seeAlso && entry.seeAlso.length > 0 && (
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
    </>
  );
};
