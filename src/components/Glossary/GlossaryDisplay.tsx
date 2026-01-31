/**
 * @file GlossaryDisplay.tsx
 * This component displays a list of icons and their meanings,
 * typically used for map legends or submap glossaries.
 */
import React from 'react';
// Pull shared type definitions from the app-level types bundle
import { GlossaryDisplayItem } from '../../types'; // Changed GlossaryItem to GlossaryDisplayItem

interface GlossaryDisplayProps {
  items: GlossaryDisplayItem[]; // Changed GlossaryItem to GlossaryDisplayItem
  title?: string;
}

const GlossaryDisplay: React.FC<GlossaryDisplayProps> = ({ items, title = "Icon Glossary" }) => {
  if (!items || items.length === 0) return null;

  // Deduplicate items based on icon to prevent the same icon appearing multiple times
  const uniqueItems = items.reduce((acc, current) => {
    const x = acc.find(item => item.icon === current.icon);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as GlossaryDisplayItem[]); // Changed GlossaryItem to GlossaryDisplayItem

  return (
    <div className="bg-gray-700 bg-opacity-80 p-3 rounded-md shadow-lg mt-2 text-xs border border-gray-600">
      <h4 className="text-sm font-semibold text-amber-300 mb-2 sticky top-0 bg-gray-700 bg-opacity-95 py-1 z-[var(--z-index-content-overlay-low)]">{title}</h4>
      <ul className="space-y-1.5 columns-2 gap-x-4"> {/* Added columns-2 and gap-x-4 */}
        {uniqueItems.map((item, index) => (
          <li 
            key={`${item.icon}-${index}`} 
            className="flex items-start"
            style={{ breakInside: 'avoid-column' }} // Prevent list items from breaking across columns
          >
            <span className="text-lg mr-2 w-6 text-center flex-shrink-0 pt-px">{item.icon}</span>
            <span className="text-gray-300">{item.meaning}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GlossaryDisplay;
