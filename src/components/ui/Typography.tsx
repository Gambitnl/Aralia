import React from 'react';

type TextProps = React.HTMLAttributes<HTMLParagraphElement | HTMLHeadingElement>;

/**
 * Standard Section Title
 * Use for major headings within a step (e.g., "Race Details", "Class Features").
 * Font: Cinzel (Serif), Large, Amber/Gold.
 */
export const SectionTitle: React.FC<TextProps> = ({ className = '', children, ...props }) => (
  <h2 className={`text-2xl font-bold font-cinzel text-amber-400 mb-4 ${className}`} {...props}>
    {children}
  </h2>
);

/**
 * Standard Subsection Title
 * Use for grouping content within a section (e.g., "Traits", "Proficiencies").
 * Font: Sans, Medium/Semibold, Sky/Blue.
 */
export const SubsectionTitle: React.FC<TextProps> = ({ className = '', children, ...props }) => (
  <h3 className={`text-lg font-semibold text-sky-400 mb-2 ${className}`} {...props}>
    {children}
  </h2>
);

/**
 * Standard Body Text
 * Use for descriptions and general content.
 * Font: Sans, Regular, Gray-300.
 */
export const BodyText: React.FC<TextProps> = ({ className = '', children, ...props }) => (
  <p className={`text-sm text-gray-300 leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);

/**
 * Standard Label
 * Use for form inputs or attribute labels.
 * Font: Sans, Uppercase, Tracking-wider, Small, Gray-400/500.
 */
export const Label: React.FC<TextProps> = ({ className = '', children, ...props }) => (
  <span className={`text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1 ${className}`} {...props}>
    {children}
  </span>
);

/**
 * Standard Description/Help Text
 * Use for subtle hints or flavor text.
 * Font: Sans, Italic, Gray-500.
 */
export const Description: React.FC<TextProps> = ({ className = '', children, ...props }) => (
  <p className={`text-xs text-gray-500 italic ${className}`} {...props}>
    {children}
  </p>
);
