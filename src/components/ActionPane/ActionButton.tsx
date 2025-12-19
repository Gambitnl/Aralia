import React from 'react';
import { motion } from 'framer-motion';
import { Action } from '../../types';
import { BTN_BASE, BTN_SIZE_LG } from '../../styles/buttonStyles';

interface ActionButtonProps {
  action: Action;
  onClick: (action: Action) => void;
  disabled: boolean;
  className?: string;
  isGeminiAction?: boolean;
  badgeCount?: number;
  hasNotification?: boolean;
  role?: string;
  tabIndex?: number;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  onClick,
  disabled,
  className = '',
  isGeminiAction = false,
  badgeCount,
  hasNotification,
  role,
  tabIndex
}) => {
  const baseClasses = `${BTN_BASE} ${BTN_SIZE_LG}`;
  let colorClasses = "btn-primary";

  // Determine color based on action type
  if (action.type === 'toggle_party_overlay') colorClasses = "btn-green";
  else if (action.type === 'save_game') colorClasses = "btn-yellow";
  else if (action.type === 'go_to_main_menu') colorClasses = "btn-red";
  else if (action.type === 'toggle_dev_menu') colorClasses = "btn-orange";
  else if (action.type === 'gemini_custom_action') colorClasses = "btn-teal";
  else if (action.type === 'ask_oracle' || (action.type === 'custom' && action.label.toLowerCase().includes('oracle'))) colorClasses = "btn-purple";
  else if (action.type === 'ANALYZE_SITUATION') colorClasses = "btn-indigo";
  else if (action.type === 'TOGGLE_DISCOVERY_LOG') colorClasses = "btn-lime";
  else if (action.type === 'TOGGLE_LOGBOOK') colorClasses = "btn-amber";
  else if (action.type === 'TOGGLE_GLOSSARY_VISIBILITY') colorClasses = "btn-indigo-dark";
  else if (action.type === 'TOGGLE_GAME_GUIDE') colorClasses = "btn-blue";

  if (isGeminiAction && action.type !== 'gemini_custom_action') {
    colorClasses = "btn-teal";
  }

  const handleClick = () => {
    // Ensure targetId for movement actions is a string to avoid type errors, without mutating prop
    if (action.type === 'move' && action.targetId && typeof action.targetId !== 'string') {
      onClick({ ...action, targetId: String(action.targetId) });
    } else {
      onClick(action);
    }
  };

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      disabled={disabled}
      className={`${baseClasses} ${colorClasses} ${className}`}
      aria-label={action.label}
      type="button"
      aria-disabled={disabled}
      role={role}
      tabIndex={tabIndex}
    >
      {action.label}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
      {hasNotification && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-gray-800 animate-pulse"></span>
      )}
    </motion.button>
  );
};
