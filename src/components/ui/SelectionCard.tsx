import React from 'react';

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
  const baseClasses = "rounded-lg shadow flex flex-col justify-between transition-all duration-150 ease-in-out border-2";
  const paddingClasses = "p-4";

  // Interactive styles
  const interactiveClasses = onClick
    ? "cursor-pointer transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-sky-500"
    : "";

  // Selected state styles
  const bgClass = selected
    ? "bg-sky-900 bg-opacity-30 border-sky-500"
    : "bg-gray-700 border-gray-600 hover:border-gray-500";

  return (
    <div
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
    </div>
  );
};
