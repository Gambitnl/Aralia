import React from 'react';
import { motion, type MotionProps } from 'framer-motion';
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

  // Semantic color system (replaces the former per-action-type rainbow).
  //
  // Instead of mapping every action.type to its own saturated hue (which gave
  // every button a different colour with no shared meaning), buttons fall into a
  // small set of meaningful categories. The category is data-driven via
  // ACTION_CATEGORY below, and each category maps to one style:
  //
  //   neutral  -> ordinary actions (the default; most buttons)
  //   primary  -> the signature / most-common action the player reaches for
  //   ai       -> AI-generated / oracle actions (a distinct affordance)
  //   danger   -> destructive / exit actions ONLY (reserved for red)
  //
  // This keeps the in-game action grid and the menu visually consistent while
  // still calling out the one primary action and the exit.
  type ActionCategory = 'neutral' | 'primary' | 'ai' | 'danger';

  // category -> button style class. The neutral default is composed from raw
  // slate utilities (already used elsewhere in the app) so no new global CSS
  // class is required; the others reuse existing `.btn-*` component classes.
  const CATEGORY_STYLE: Record<ActionCategory, string> = {
    neutral: 'bg-slate-700 hover:bg-slate-600 text-gray-100 focus:ring-slate-500',
    primary: 'btn-primary',
    ai: 'btn-teal',
    danger: 'btn-red',
  };

  // Explicit, data-driven action.type -> semantic category map. Anything not
  // listed here is `neutral` (the default), so ordinary actions stay quiet.
  const ACTION_CATEGORY: Record<string, ActionCategory> = {
    // Signature / most-common action: surveying & analysing the situation.
    ANALYZE_SITUATION: 'primary',
    // AI-generated actions.
    gemini_custom_action: 'ai',
    ask_oracle: 'ai',
    // Destructive / exit — the ONLY red.
    go_to_main_menu: 'danger',
  };

  let category: ActionCategory = ACTION_CATEGORY[action.type] ?? 'neutral';

  // Oracle actions may arrive as generic `custom` actions identified by label.
  if (
    category === 'neutral' &&
    action.type === 'custom' &&
    action.label?.toLowerCase().includes('oracle')
  ) {
    category = 'ai';
  }

  // Any Gemini/AI action (flagged by the caller) reads as the AI affordance.
  if (isGeminiAction) {
    category = 'ai';
  }

  const colorClasses = CATEGORY_STYLE[category];

  const handleClick = () => {
    // Move actions now arrive with string target ids from the generator layer.
    // Keep this button path passive so it does not hide producer contract drift.
    onClick(action);
  };

  const motionProps: MotionProps = {
    layout: true,
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
  };

  return (
    <motion.button
      {...motionProps}
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
