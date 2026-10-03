/**
 * @file Typography.tsx
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
type TextProps = React.HTMLAttributes<HTMLParagraphElement | HTMLHeadingElement>;
/**
 * Standard Section Title
 * Use for major headings within a step (e.g., "Race Details", "Class Features").
 * Font: Cinzel (Serif), Large, Amber/Gold.
 */
export declare const SectionTitle: React.FC<TextProps>;
/**
 * Standard Subsection Title
 * Use for grouping content within a section (e.g., "Traits", "Proficiencies").
 * Font: Sans, Medium/Semibold, Sky/Blue.
 */
export declare const SubsectionTitle: React.FC<TextProps>;
/**
 * Standard Body Text
 * Use for descriptions and general content.
 * Font: Sans, Regular, Gray-300.
 */
export declare const BodyText: React.FC<TextProps>;
/**
 * Standard Label
 * Use for form inputs or attribute labels.
 * Font: Sans, Uppercase, Tracking-wider, Small, Gray-400/500.
 */
export declare const Label: React.FC<TextProps>;
/**
 * Standard Description/Help Text
 * Use for subtle hints or flavor text.
 * Font: Sans, Italic, Gray-500.
 */
export declare const Description: React.FC<TextProps>;
export {};
