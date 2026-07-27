/**
 * @file Button.tsx
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
import { HTMLMotionProps } from 'framer-motion';
export type ButtonVariant = 'primary' | 'action' | 'success' | 'danger' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export interface ButtonProps extends HTMLMotionProps<"button"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    children?: React.ReactNode;
}
/**
 * A reusable Button component that encapsulates standard application styles.
 *
 * Enhanced with a non-layout-shifting loading state using a spinner overlay.
 * Uses opacity-0 instead of invisible to ensure screen readers can still read the button text.
 *
 * ✨ Illusionist Motion:
 * - Adds a subtle scale-down effect on tap/click for tactile feedback.
 *
 * Usage:
 * <Button variant="primary" size="md" onClick={handleClick}>Click Me</Button>
 */
export declare const Button: React.ForwardRefExoticComponent<Omit<ButtonProps, "ref"> & React.RefAttributes<HTMLButtonElement>>;
