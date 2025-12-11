/**
 * @file WorldPane.tsx
 * This component displays the game's message log, showing system messages,
 * player actions, and NPC dialogue. It automatically scrolls to the latest message.
 */
import React, { useEffect, useRef } from 'react';
import { GameMessage } from '../types'; // Path relative to src/components/
import Tooltip from './Tooltip'; // Import the new Tooltip component
import { formatGameTime } from '../utils/timeUtils';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Scrolls the message container to the bottom.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    const tooltipKeywords: Record<string, string> = {
      'Aralia': 'The vibrant world where your adventure unfolds.',
      'Oracle': 'A mysterious entity offering cryptic guidance.',
      'Gemini': 'The advanced AI model powering this world\'s narrative and interactions.',
      'NPC': 'Non-Player Character: Any character in the game not controlled by you.',
      'HP': 'Hit Points: A measure of your character\'s health and vitality.',
      'AC': 'Armor Class: Represents how difficult it is to hit your character in combat.',
      'clearing': 'A sun-dappled opening in the forest, often a place of peace or transition.',
      'ruins': 'The crumbling remnants of ancient structures, hinting at a forgotten past.'
    };

    const regex = new RegExp(`\\b(${Object.keys(tooltipKeywords).join('|')})\\b`, 'gi');
    
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const lowerPart = part.toLowerCase();
      const matchedKeyword = Object.keys(tooltipKeywords).find(kw => kw.toLowerCase() === lowerPart);

      if (matchedKeyword) {
        return (
          <Tooltip
            key={`${part}-${index}-tooltip`}
            content={tooltipKeywords[matchedKeyword]}
          >
            <span 
              className="text-sky-400 underline decoration-sky-500/70 decoration-dotted cursor-help"
              tabIndex={0} // Make it focusable
            >
              {part}
            </span>
          </Tooltip>
        );
      }
      return part;
    });
  };


  return (
    <div className="flex-grow bg-gray-800 p-6 rounded-lg shadow-xl overflow-y-auto scrollable-content border border-gray-700 min-h-0">
      {' '}
      {/* Added min-h-0 for flex-grow with overflow */}
      <h2 className="text-2xl font-bold text-amber-400 mb-4 border-b-2 border-amber-500 pb-2">
        Log
      </h2>
      <div className="space-y-3 text-lg leading-relaxed">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-2 rounded ${
              msg.sender === 'player' ? 'text-right' : ''
            }`}
          >
            <p className={`${getMessageStyle(msg.sender)}`}>
              {processMessageText(msg.text)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatGameTime(new Date(msg.timestamp))}
            </p>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* Anchor for scrolling to bottom */}
      </div>
    </div>
  );
};

export default WorldPane;