// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/03/2026, 00:15:45
 * Dependents: components/CharacterSheet/Skills/SkillDetailDisplay.tsx, components/CharacterSheet/Skills/SkillsTab.tsx, components/Glossary/SpellCardTemplate.tsx, components/Glossary/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file GlossaryTooltip.tsx
 * This component wraps the standard Tooltip to dynamically fetch and display
 * content from the glossary based on a termId.
 * It now uses a global context to get pre-loaded excerpts and lets the trigger
 * element itself own navigation.
 *
 * Why it changed:
 * The previous version rendered a clickable button inside the tooltip that
 * suggested "click for full entry". In practice that was frustrating because
 * moving the mouse from the chip to the tooltip caused the tooltip to disappear.
 * The owner explicitly wants the chip to act as the button instead.
 *
 * What this preserves:
 * - Hover/focus still reveals glossary excerpts.
 * - Clicking the chip still navigates to the full glossary entry when possible.
 * - Missing-term/error states still degrade safely to read-only tooltip text.
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

  /**
   * Keep navigation on the trigger chip/button instead of inside the tooltip body.
   *
   * Why it exists:
   * The tooltip should behave like help text, not like a disappearing intermediate
   * button. Centralizing the navigation here means every trigger wrapped by
   * GlossaryTooltip can stay directly clickable without duplicating this handler.
   */
  const handleTriggerActivate = (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    if (!onNavigateToGlossary || !termId || !entry || error) return;
    event.preventDefault();
    event.stopPropagation();
    onNavigateToGlossary(termId);
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
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      children.props.onClick?.(event);
      if (!event.defaultPrevented) {
        handleTriggerActivate(event);
      }
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      children.props.onKeyDown?.(event);
      if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) {
        handleTriggerActivate(event);
      }
    },
  });


  const isClickable = Boolean(onNavigateToGlossary && entry && !error);

  return (
    <Tooltip 
      content={
        <div
          className={`p-1 -m-1 ${isClickable ? 'cursor-default' : ''}`}
          id={`tooltip-for-${termId}`}
        >
          <p className="text-xs whitespace-pre-wrap">{finalDisplayContent}</p>
        </div>
      }
    >
      {triggerElement}
    </Tooltip>
  );
};

export default GlossaryTooltip;
