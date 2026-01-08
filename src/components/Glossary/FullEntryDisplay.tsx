import React, { useEffect, useState } from 'react';
import { GlossaryEntry } from '../../types';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { assetUrl } from '../../config/env';
import { GlossaryEntryTemplate } from './GlossaryEntryTemplate';

const stripMainHeading = (markdownContent: string): string => {
  // Remove YAML frontmatter if it exists
  const yamlFrontmatterRegex = /^\s*---([\s\S]*?)---(?:\r?\n|\r|$)/;
  let content = markdownContent.replace(yamlFrontmatterRegex, '').trimStart();

  // TODO: Improve heading removal to support alternate Markdown H1 syntax (e.g., 'Title\n===') or use a Markdown AST parser to remove the first heading node safely, ensuring consistent rendering regardless of source formatting.
  // Remove the first H1 heading (e.g., "# Heading") as we now render it separately
  const h1Regex = /^#\s+.+$/m;
  content = content.replace(h1Regex, '').trimStart();

  return content;
};

type GlossaryEntryFileJson = {
  markdown?: string;
  content?: string;
};

interface FullEntryDisplayProps {
  entry: GlossaryEntry | null;
  onNavigate?: (termId: string) => void;
}

export const FullEntryDisplay: React.FC<FullEntryDisplayProps> = ({ entry, onNavigate }) => {
  const [fetchState, setFetchState] = useState<{
    filePath: string | null;
    markdownContent: string | null;
    enrichedEntry: GlossaryEntry | null;
    error: string | null;
  }>({
    filePath: null,
    markdownContent: null,
    enrichedEntry: null,
    error: null
  });

  const filePath = entry?.filePath;
  const markdownContent = filePath === fetchState.filePath ? fetchState.markdownContent : null;
  const enrichedEntry = filePath === fetchState.filePath ? fetchState.enrichedEntry : null;
  const error = !filePath
    ? "No file path provided for glossary entry."
    : filePath === fetchState.filePath
      ? fetchState.error
      : null;
  const loading = Boolean(filePath && filePath !== fetchState.filePath);

  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;

    const fullPath = assetUrl(filePath);
    const isJsonEntry = filePath.toLowerCase().endsWith('.json');

    const fetchPromise = isJsonEntry
      ? fetchWithTimeout<any>(fullPath)
      : fetchWithTimeout<string>(fullPath, { responseType: 'text' });

    fetchPromise
      .then((data) => {
        if (cancelled) return;
        if (isJsonEntry) {
          const json = data as any;
          const nextMarkdown =
            typeof json.markdown === 'string'
              ? json.markdown
              : typeof json.content === 'string'
                ? json.content
                : '';

          setFetchState({
            filePath,
            markdownContent: stripMainHeading(nextMarkdown),
            enrichedEntry: { ...entry, ...json } as GlossaryEntry,
            error: null
          });
          return;
        }

        const text = data as string;
        setFetchState({
          filePath,
          markdownContent: stripMainHeading(text),
          enrichedEntry: entry,
          error: null
        });
      })
      .catch(err => {
        if (cancelled) return;
        console.error(`Error fetching ${filePath}:`, err);
        setFetchState({
          filePath,
          markdownContent: null,
          enrichedEntry: null,
          error: err.message
        });
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, entry]); // Added entry as dependency to ensure we merge the right data

  if (loading) return <p className="text-gray-400 italic">Loading full entry...</p>;
  if (error) return <p className="text-red-400">Error loading content: {error}</p>;
  if (!markdownContent && !enrichedEntry) return <p className="text-gray-500 italic">No content found for this entry.</p>;

  return (
    <GlossaryEntryTemplate
      entry={enrichedEntry || entry}
      markdownContent={markdownContent}
      onNavigate={onNavigate}
    />
  );
};