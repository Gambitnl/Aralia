import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Spinner } from './Spinner';
import {
  BTN_BASE,
  BTN_SIZE_SM, BTN_SIZE_MD, BTN_SIZE_LG,
  BTN_PRIMARY, BTN_ACTION, BTN_SUCCESS, BTN_DANGER, BTN_SECONDARY, BTN_GHOST
} from '../../styles/buttonStyles';

export type ButtonVariant = 'primary' | 'action' | 'success' | 'danger' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Extend HTMLMotionProps directly so consumers get all standard button props + motion props
export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const VARIANT_MAP: Record<ButtonVariant, string> = {
  primary: BTN_PRIMARY,
  action: BTN_ACTION,
  success: BTN_SUCCESS,
  danger: BTN_DANGER,
  secondary: BTN_SECONDARY,
  ghost: BTN_GHOST,
};

const SIZE_MAP: Record<ButtonSize, string> = {
  sm: BTN_SIZE_SM,
  md: BTN_SIZE_MD,
  lg: BTN_SIZE_LG,
};

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
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const variantClass = VARIANT_MAP[variant];
    const sizeClass = SIZE_MAP[size];

    const isInteractive = !disabled && !isLoading;

    return (
      <motion.button
        ref={ref}
        className={`${BTN_BASE} ${sizeClass} ${variantClass} relative ${className}`}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        whileTap={isInteractive ? { scale: 0.97 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...props}
      >
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner className="h-5 w-5" />
          </span>
        )}
        <span className={`${isLoading ? 'opacity-0' : ''}`}>
          {children}
        </span>
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
