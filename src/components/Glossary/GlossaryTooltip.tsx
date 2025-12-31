/**
 * @file GlossaryTooltip.tsx
 * This component wraps the standard Tooltip to dynamically fetch and display
 * content from the glossary based on a termId.
 * It now uses a global context to get pre-loaded excerpts and provides a click handler for navigation.
 */
import React, { useContext, ReactElement, HTMLAttributes } from 'react';
// Use the shared Tooltip and context so glossary tooltips match app styling/state
import Tooltip from '../Tooltip'; 
import GlossaryContext from '../../context/GlossaryContext'; 
import { GlossaryEntry, GlossaryTooltipProps as LocalGlossaryTooltipProps } from '../../types'; // Corrected import for GlossaryEntry

// Use LocalGlossaryTooltipProps for this component's props
interface CustomGlossaryTooltipProps extends LocalGlossaryTooltipProps {
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}

const GlossaryTooltip: React.FC<CustomGlossaryTooltipProps> = ({ children, termId, onNavigateToGlossary }) => {
  const entries = useContext(GlossaryContext);
  
  let displayContent: string | React.ReactNode = `Details for: ${termId}`;
  let entry: GlossaryEntry | undefined | null = null;
  let isLoading = false;
  let error: string | null = null;

  if (entries === null) {
    isLoading = true;
    displayContent = 'Loading glossary index...';
  } else if (entries.length === 0 && !isLoading) {
    error = 'Glossary index is empty or failed to load.';
    displayContent = `Error: ${error}`;
  } else if (entries) {
    entry = entries.find(e => e.id === termId);
    if (!entry) {
      error = `Glossary term "${termId}" not found.`;
      displayContent = `Error: ${error}`;
    } else {
      displayContent = entry.excerpt || "No excerpt available.";
    }
  }


  const handleTooltipClick = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation(); 
    if (onNavigateToGlossary && termId && entry && !error) {
      onNavigateToGlossary(termId);
    }
  };
  
  const finalDisplayContent = isLoading
    ? 'Loading glossary...'
    : error
    ? displayContent // Error message already set in displayContent
    : displayContent || `Details for: ${termId}`;
  
  // Ensure children is a valid React element that can accept a ref and event handlers
  const triggerElement = React.cloneElement(children, {
    className: `${children.props.className || ''} glossary-term-link`,
    tabIndex: children.props.tabIndex !== undefined ? children.props.tabIndex : 0, // Make it focusable if not already
    role: 'link', // Semantically it behaves like a link to more info
    'aria-describedby': `tooltip-for-${termId}`, // This ID will be on the tooltip itself
  });


  const isClickable = Boolean(onNavigateToGlossary && entry && !error);

  return (
    <Tooltip 
      content={
        isClickable ? (
          <button
            type="button"
            onClick={handleTooltipClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleTooltipClick(e);
              }
            }}
            className="cursor-pointer hover:bg-gray-600/50 p-1 -m-1 rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
            aria-label={`View full details for ${entry?.title ?? 'glossary entry'} in glossary`}
            id={`tooltip-for-${termId}`}
          >
            <p className="text-xs whitespace-pre-wrap">{finalDisplayContent}</p>
            <span className="block text-center text-[10px] text-sky-400 mt-1">(Click for full entry)</span>
          </button>
        ) : (
          <div className="p-1 -m-1" id={`tooltip-for-${termId}`}>
            <p className="text-xs whitespace-pre-wrap">{finalDisplayContent}</p>
          </div>
        )
      }
    >
      {triggerElement}
    </Tooltip>
  );
};

export default GlossaryTooltip;
