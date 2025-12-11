import React, { useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface GlossaryContentRendererProps {
  markdownContent: string;
  onNavigate?: (termId: string) => void;
}

export const GlossaryContentRenderer: React.FC<GlossaryContentRendererProps> = ({ markdownContent, onNavigate }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const structuredHtml = useMemo(() => {
    if (!markdownContent) return '';

    // Replace Markdown horizontal rules with styled HTML ones before parsing
    const preppedMarkdown = markdownContent.replace(/^---$/gm, '<hr />');
    
    const rawHtml = marked.parse(preppedMarkdown, { gfm: true, breaks: true, async: false }) as string;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;

    const finalContainer = document.createElement('div');
    let currentDetails: HTMLDetailsElement | null = null;
    let currentContentDiv: HTMLDivElement | null = null;
    let inFeatureSection = false;

    const hasFeaturesHeader = Array.from(tempDiv.querySelectorAll('h2')).some(h2 => h2.textContent?.includes('Features'));

    Array.from(tempDiv.childNodes).forEach(node => {
        const nodeName = node.nodeName;

        if (!hasFeaturesHeader) inFeatureSection = true;

        if (nodeName === 'H2' && node.textContent?.includes('Features')) {
            inFeatureSection = true;
            currentDetails = null;
            currentContentDiv = null;
            finalContainer.appendChild(node.cloneNode(true));
            return;
        }

        if (inFeatureSection && nodeName === 'H3') {
            currentDetails = document.createElement('details');
            currentDetails.className = 'feature-card';
            currentDetails.open = true;

            const summary = document.createElement('summary');
            const summaryH3 = document.createElement('h3');
            summaryH3.innerHTML = (node as HTMLElement).innerHTML;
            summary.appendChild(summaryH3);
            currentDetails.appendChild(summary);

            currentContentDiv = document.createElement('div');
            currentDetails.appendChild(currentContentDiv);

            finalContainer.appendChild(currentDetails);
        } else if (currentDetails && currentContentDiv) {
            currentContentDiv.appendChild(node.cloneNode(true));
        } else {
            finalContainer.appendChild(node.cloneNode(true));
        }
    });

    return DOMPurify.sanitize(finalContainer.innerHTML);
  }, [markdownContent]);

  useEffect(() => {
    if (structuredHtml && contentRef.current && onNavigate) {
        const links = contentRef.current.querySelectorAll('span.glossary-term-link-from-markdown[data-term-id]');
        links.forEach(link => {
            const termId = link.getAttribute('data-term-id');
            if (termId) {
                const handler = (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNavigate(termId);
                };
                if (!(link as any)._glossaryClickHandler) {
                    link.addEventListener('click', handler);
                    link.addEventListener('keydown', (e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            handler(e);
                        }
                    });
                    (link as any)._glossaryClickHandler = true;
                }
            }
        });
    }
  }, [structuredHtml, onNavigate]);
  
  return <div ref={contentRef} dangerouslySetInnerHTML={{ __html: structuredHtml }} />;
};