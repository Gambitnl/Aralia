import React from 'react';
import { motion } from 'framer-motion';

interface SelectionListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
  rightContent?: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * Standard List Item for Selection Panes (Race, Class lists).
 * Used in SplitPaneLayout controls.
 */
export const SelectionListItem: React.FC<SelectionListItemProps> = ({
  label,
  selected = false,
  rightContent,
  icon,
  className = '',
  ...props
}) => {
  return (
    <button
      type="button"
      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent flex items-center justify-between ${
        selected
          ? 'bg-sky-900/40 border-sky-500/50 text-sky-300 shadow-md font-semibold'
          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
      } ${className}`}
      {...props}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{label}</span>
      </div>
      
      <div className="flex items-center gap-2">
        {rightContent}
        {selected && (
          <motion.span layoutId="active-selection-indicator" className="text-sky-400 text-sm">
            ▶
          </motion.span>
        )}
      </div>
    </button>
  );
};
