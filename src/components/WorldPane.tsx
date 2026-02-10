/**
 * @file WorldPane.tsx
 * This component displays the game's message log, showing system messages,
 * player actions, and NPC dialogue. It automatically scrolls to the latest message.
 */
import React, { useEffect, useRef, useContext } from 'react';
import { GameMessage } from '../types'; // Path relative to src/components/
import { formatGameTime, getGameDay } from '@/utils/core';
import Tooltip from './ui/Tooltip'; // Import the new Tooltip component
import GlossaryContext from '../context/GlossaryContext';
import { LoreService } from '../services/LoreService';
import { UI_ID } from '../styles/uiIds';

interface WorldPaneProps {
  messages: GameMessage[];
}

/**
 * WorldPane component.
 * Renders the list of game messages with appropriate styling for different senders.
 * Automatically scrolls to the bottom when new messages are added.
 * @param {WorldPaneProps} props - The props for the component.
 * @returns {React.FC} The rendered WorldPane component.
 */
const WorldPane: React.FC<WorldPaneProps> = ({ messages }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const glossaryEntries = useContext(GlossaryContext);

  /**
   * Scrolls the message container to the bottom.
   */
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(scrollToBottom, [messages]); // Scroll when messages change

  /**
   * Determines the CSS class for a message based on its sender.
   * @param {GameMessage['sender']} sender - The sender of the message.
   * @returns {string} The CSS class string.
   */
  const getMessageStyle = (sender: GameMessage['sender']): string => {
    switch (sender) {
      case 'system':
        return 'text-sky-300 italic';
      case 'player':
        return 'text-amber-300';
      case 'npc':
        return 'text-emerald-300';
      default:
        return 'text-gray-300';
    }
  };

  /**
   * Processes message text to include tooltips for specific keywords.
   * @param {string} text - The message text.
   * @returns {React.ReactNode} The message text, potentially with Tooltip components.
   */
  const processMessageText = (text: string): React.ReactNode => {
    // RALPH: Knowledge Injector.
    // Uses the LoreService to dynamically match text against the full game glossary.
    // This provides on-demand help for rules, items, and lore.
    if (!glossaryEntries || glossaryEntries.length === 0) return text;

    const matchedEntries = LoreService.findTermsInText(text, glossaryEntries);
    if (matchedEntries.length === 0) return text;

    // Create regex from matched entry titles and aliases
    const terms = matchedEntries.flatMap(e => [e.title, ...(e.aliases || [])]);
    const regex = LoreService.getTermsRegex(terms);

    const parts = text.split(regex);

    return parts.map((part, index) => {
      const lowerPart = part.toLowerCase();
      // Find which entry matched this specific part
      const entry = matchedEntries.find(e =>
        e.title.toLowerCase() === lowerPart ||
        e.aliases?.some(a => a.toLowerCase() === lowerPart)
      );

      if (entry) {
        return (
          <Tooltip
            key={`${part}-${index}-tooltip`}
            content={entry.excerpt || entry.title}
          >
            <button
              type="button"
              className="text-sky-400 underline decoration-sky-500/70 decoration-dotted cursor-help bg-transparent border-0 p-0"
            >
              {part}
            </button>
          </Tooltip>
        );
      }
      return part;
    });
  };


  return (
    <div
      id={UI_ID.WORLD_PANE}
      data-testid={UI_ID.WORLD_PANE}
      ref={scrollContainerRef}
      className="flex-grow bg-gray-800 p-6 rounded-lg shadow-xl overflow-y-auto scrollable-content border border-gray-700 min-h-0"
    >
      {' '}
      {/* Added min-h-0 for flex-grow with overflow */}
      <h2 className="text-2xl font-bold text-amber-400 mb-4 border-b-2 border-amber-500 pb-2">
        Log
      </h2>
      <div className="space-y-3 text-lg leading-relaxed">
        {messages.map((msg) => {
          const isBanter = msg.metadata?.type === 'banter';

          if (isBanter) {
            // Extract name and text if possible (format: Name: "Text")
            const match = msg.text.match(/^([^:]+): "(.*)"$/);
            const speakerName = match ? match[1] : '';
            const dialogue = match ? match[2] : msg.text;

            return (
              <div
                key={msg.id}
                className="p-4 rounded-xl bg-gray-900/60 border border-amber-900/30 my-2 shadow-sm"
              >
                {speakerName && (
                  <h4 className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-1">
                    {speakerName}
                  </h4>
                )}
                <p className="text-amber-100 italic text-base leading-relaxed">
                  &quot;{processMessageText(dialogue)}&quot;
                </p>
                <p className="text-[10px] text-gray-600 mt-2 text-right">
                  {formatGameTime(new Date(msg.timestamp), {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`p-2 rounded ${msg.sender === 'player' ? 'text-right' : ''
                }`}
            >
              <p className={`${getMessageStyle(msg.sender)}`}>
                {processMessageText(msg.text)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatGameTime(new Date(msg.timestamp), {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          );
        })}

      </div>
    </div>
  );
};

export default WorldPane;
