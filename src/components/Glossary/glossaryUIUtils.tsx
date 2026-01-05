import React from 'react';

// Category icons mapping - returns SVG icons for each glossary category
export const getCategoryIcon = (category: string): React.ReactNode => {
  const iconClass = "w-4 h-4 inline-block mr-1.5 opacity-80";

  switch (category.toLowerCase()) {
    case 'character classes':
      // Shield/sword icon for classes
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'character races':
      // People/faces icon for races
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
    case 'spells':
      // Sparkle/magic icon for spells
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
        </svg>
      );
    case 'rules glossary':
      // Book icon for rules
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <path d="M8 7h8M8 11h6" />
        </svg>
      );
    case 'conditions':
      // Warning/status icon for conditions
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
    case 'equipment':
      // Backpack/gear icon for equipment
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 10h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10z" />
          <path d="M8 10V6a4 4 0 018 0v4" />
          <path d="M12 14v4" />
        </svg>
      );
    case 'actions':
      // Lightning/action icon for actions
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'magic items':
      // Gem/treasure icon for magic items
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 3h12l4 6-10 13L2 9l4-6z" />
          <path d="M2 9h20M12 22V9M6 3l6 6 6-6" />
        </svg>
      );
    case 'crafting':
      // Hammer icon for crafting
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case 'spellcasting mechanics':
      // Scroll icon for spellcasting mechanics
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 21h12a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path d="M6 9a2 2 0 01-2-2V5a2 2 0 012-2h2" />
          <path d="M6 21a2 2 0 01-2-2v-2a2 2 0 012-2h2" />
          <path d="M10 9h6M10 13h4" />
        </svg>
      );
    case 'developer':
      // Code/dev icon
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
        </svg>
      );
    case 'proficiency':
      // Star/skill icon
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case 'expertise':
      // Double star for expertise
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l2.09 6.26L20 9l-4.5 4.14L17 19l-5-3.5L7 19l1.5-5.86L4 9l5.91-.74L12 2z" />
          <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
        </svg>
      );
    case 'exploration':
      // Compass icon
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" opacity="0.3" />
        </svg>
      );
    case 'speed':
      // Running/speed icon
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4v4l4-2" />
          <circle cx="13" cy="4" r="2" />
          <path d="M10 10.5L7 14l3 3.5" />
          <path d="M15.5 11l2.5 5-4 2" />
          <path d="M7 8l3 2.5L13 8" />
        </svg>
      );
    default:
      // Default scroll/document icon
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
  }
};

// Highlight search term in text
export const highlightSearchTerm = (text: string, searchTerm: string): React.ReactNode => {
  if (!searchTerm.trim()) return text;

  const regex = new RegExp(`(${escapeRegex(searchTerm.trim())})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amber-500/40 text-amber-100 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

// Escape special regex characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Breadcrumb component
interface BreadcrumbProps {
  category: string;
  parentPath: string[]; // Array of parent entry titles
  currentTitle: string;
  onNavigateToCategory?: () => void;
  onNavigateToParent?: (index: number) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  category,
  parentPath,
  currentTitle,
  onNavigateToCategory,
  onNavigateToParent,
}) => {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 mb-3 flex-wrap" aria-label="Breadcrumb">
      <button
        onClick={onNavigateToCategory}
        className="hover:text-sky-300 transition-colors flex items-center gap-1"
      >
        {getCategoryIcon(category)}
        <span>{category}</span>
      </button>

      {parentPath.map((parent, index) => (
        <React.Fragment key={index}>
          <span className="text-gray-600 mx-0.5">/</span>
          <button
            onClick={() => onNavigateToParent?.(index)}
            className="hover:text-sky-300 transition-colors truncate max-w-[150px]"
            title={parent}
          >
            {parent}
          </button>
        </React.Fragment>
      ))}

      {(category || parentPath.length > 0) && (
        <span className="text-gray-600 mx-0.5">/</span>
      )}
      <span className="text-amber-300 font-medium truncate max-w-[200px]" title={currentTitle}>
        {currentTitle}
      </span>
    </nav>
  );
};

// Get category color for visual differentiation
export const getCategoryColor = (category: string): string => {
  switch (category.toLowerCase()) {
    case 'character classes':
      return 'text-red-400';
    case 'character races':
      return 'text-green-400';
    case 'spells':
      return 'text-purple-400';
    case 'rules glossary':
      return 'text-blue-400';
    case 'conditions':
      return 'text-orange-400';
    case 'equipment':
      return 'text-yellow-400';
    case 'actions':
      return 'text-cyan-400';
    case 'magic items':
      return 'text-pink-400';
    case 'crafting':
      return 'text-amber-500';
    default:
      return 'text-sky-300';
  }
};
