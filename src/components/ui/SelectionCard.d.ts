/**
 * @file SelectionCard.tsx
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
import { HTMLMotionProps } from 'framer-motion';
export interface SelectionCardProps extends HTMLMotionProps<"div"> {
    title: string;
    selected?: boolean;
    onClick?: () => void;
    /**
     * Optional footer content (e.g. action buttons).
     * If provided, the card body will have flex-grow to push footer to bottom.
     */
    footer?: React.ReactNode;
    children?: React.ReactNode;
}
/**
 * A reusable card component for selection grids (Race, Class, Background, etc.).
 * Supports both interactive (whole card clickable) and container modes.
 *
 * ✨ Illusionist Motion:
 * - Added tactile scale effects (hover/tap) using Framer Motion.
 */
export declare const SelectionCard: React.FC<SelectionCardProps>;
