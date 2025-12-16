import React from 'react';
import { motion } from 'framer-motion';

export interface SelectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  selected?: boolean;
  onClick?: () => void;
  /**
   * Optional footer content (e.g. action buttons).
   * If provided, the card body will have flex-grow to push footer to bottom.
   */
  footer?: React.ReactNode;
}

/**
 * A reusable card component for selection grids (Race, Class, Background, etc.).
 * Supports both interactive (whole card clickable) and container modes.
 *
 * ✨ Illusionist Motion:
 * - Added tactile scale effects (hover/tap) using Framer Motion.
 */
export const SelectionCard: React.FC<SelectionCardProps> = ({
  title,
  selected = false,
  onClick,
  children,
  footer,
  className = '',
  ...props
}) => {
  // Use transition-colors for border/bg changes, but let Framer handle layout/transform
  const baseClasses = "rounded-lg shadow flex flex-col justify-between transition-colors duration-150 ease-in-out border-2";
  const paddingClasses = "p-4";

  // Interactive styles - removed manual transform/hover:scale to avoid conflict with Framer Motion
  const interactiveClasses = onClick
    ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
    : "";

  // Selected state styles
  const bgClass = selected
    ? "bg-sky-900 bg-opacity-30 border-sky-500"
    : "bg-gray-700 border-gray-600 hover:border-gray-500";

  return (
    <motion.div
      onClick={onClick}
      className={`${baseClasses} ${paddingClasses} ${bgClass} ${interactiveClasses} ${className}`}
      role={onClick ? "button" : undefined}
      aria-pressed={onClick ? selected : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
        props.onKeyDown?.(e);
      }}
      whileHover={onClick ? { scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      <div className="flex-grow">
        <h3 className={`text-xl font-semibold mb-2 ${selected ? 'text-sky-300' : 'text-amber-400'}`}>
            {title}
        </h3>
        <div className="text-sm text-gray-300">
            {children}
        </div>
      </div>
      {footer && (
        <div className="mt-4">
            {footer}
        </div>
      )}
    </motion.div>
  );
};
