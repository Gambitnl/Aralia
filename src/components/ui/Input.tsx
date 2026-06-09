// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:21:07
 * Dependents: components/DesignPreview/steps/PreviewComponents.tsx, components/ui/BanterInterruptUI.tsx, components/ui/OllamaDependencyModal.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @file src/components/ui/Input.tsx
 * @component-owner UI Team / Core Engine
 * @status Stable / Maintained
 * 
 * Reusable premium form input primitives designed for the Aralia RPG.
 * Provides consistent, glassmorphic styling, tactile focus transitions, 
 * and robust type safety for standard user inputs (text, numbers, checkboxes, selects).
 * 
 * Used by:
 * - OllamaDependencyModal.tsx (Checkbox for opting out of AI prompts)
 * - BanterInterruptUI.tsx (Text input for players joining character banter)
 * - PreviewComponents.tsx (For interactive showcases of modular elements)
 */

// ============================================================================
// Core Styling Constants
// ============================================================================
// Shared design tokens to keep inputs looking consistent. 
// They feature a premium glassmorphic background, custom borders, 
// and subtle warm amber focus states aligned with Aralia's fantasy theme.
// ============================================================================

const INPUT_BASE_CLASSES = 
  "w-full px-3 py-2 bg-gray-800/85 backdrop-blur-sm border border-gray-700/80 hover:border-gray-600/90 rounded-lg text-gray-100 placeholder-gray-500 transition-all duration-200 outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed";

// ============================================================================
// 1. Text/Number Input Component
// ============================================================================
// Standard single-line input field supporting custom labels and error states.
// ============================================================================

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helperText, disabled, id, ...props }, ref) => {
    // Determine the border color based on the current state (error vs. default).
    const borderClass = error 
      ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/50" 
      : "";
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const feedbackId = error || helperText ? `${inputId}-feedback` : undefined;
    const describedBy = [props['aria-describedby'], feedbackId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {/* Render label text if provided */}
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-amber-400/85 select-none">
            {label}
          </label>
        )}

        <div className="relative">
          <input
            {...props}
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${INPUT_BASE_CLASSES} ${borderClass} ${className}`}
          />
        </div>

        {/* Display validation errors with a gentle fade-in animation */}
        <AnimatePresence>
          {error ? (
            <motion.span 
              id={feedbackId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-xs text-red-400 font-medium"
            >
              ⚠️ {error}
            </motion.span>
          ) : helperText ? (
            // Show helpful hints if no errors are present.
            <span id={feedbackId} className="text-xs text-gray-500">
              {helperText}
            </span>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================================================
// 2. Multiline Textarea Component
// ============================================================================
// A flexible multiline text field that scales its height based on content.
// ============================================================================

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = '', label, error, helperText, disabled, id, ...props }, ref) => {
    // Align border classes with current validation state.
    const borderClass = error 
      ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/50" 
      : "";
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const feedbackId = error || helperText ? `${textareaId}-feedback` : undefined;
    const describedBy = [props['aria-describedby'], feedbackId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {/* Render textarea label */}
        {label && (
          <label htmlFor={textareaId} className="text-xs font-semibold uppercase tracking-wider text-amber-400/85 select-none">
            {label}
          </label>
        )}

        <textarea
          {...props}
          ref={ref}
          id={textareaId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${INPUT_BASE_CLASSES} min-h-[100px] resize-y ${borderClass} ${className}`}
        />

        {/* Dynamic error display */}
        <AnimatePresence>
          {error ? (
            <motion.span 
              id={feedbackId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-xs text-red-400 font-medium"
            >
              ⚠️ {error}
            </motion.span>
          ) : helperText ? (
            <span id={feedbackId} className="text-xs text-gray-500">
              {helperText}
            </span>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

// ============================================================================
// 3. Selection Dropdown Component
// ============================================================================
// Standard selector with a styled arrow and custom options wrapper.
// ============================================================================

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, helperText, options = [], children, disabled, id, ...props }, ref) => {
    // Apply styling to standard select components.
    const borderClass = error 
      ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/50" 
      : "";
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const feedbackId = error || helperText ? `${selectId}-feedback` : undefined;
    const describedBy = [props['aria-describedby'], feedbackId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {/* Render selection label */}
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-wider text-amber-400/85 select-none">
            {label}
          </label>
        )}

        <div className="relative w-full">
          <select
            {...props}
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${INPUT_BASE_CLASSES} appearance-none pr-10 ${borderClass} ${className}`}
          >
            {/* Accept children OR dynamic options array */}
            {children || options.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-gray-900 text-gray-100">
                {opt.label}
              </option>
            ))}
          </select>

          {/* Premium dropdown chevron indicator */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-amber-500/80">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Display validation feedback */}
        <AnimatePresence>
          {error ? (
            <motion.span 
              id={feedbackId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-xs text-red-400 font-medium"
            >
              ⚠️ {error}
            </motion.span>
          ) : helperText ? (
            <span id={feedbackId} className="text-xs text-gray-500">
              {helperText}
            </span>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================================================
// 4. Interactive Checkbox Component
// ============================================================================
// A beautiful premium animated checkbox for boolean toggles.
// Uses framer-motion to animate the inner checkmark on click.
// ============================================================================

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', label, checked, onChange, disabled, ...props }, ref) => {
    return (
      <label className={`flex items-center space-x-2.5 cursor-pointer select-none group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <div className="relative flex items-center justify-center">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="sr-only" // Hide native checkbox, styling the custom block instead
            {...props}
          />

          {/* Customized box container featuring gold transitions on checked status */}
          <div 
            className={`w-5 h-5 rounded border transition-all duration-200 flex items-center justify-center ${
              checked 
                ? 'bg-amber-600 border-amber-500 shadow-md shadow-amber-500/20' 
                : 'bg-gray-800 border-gray-600 group-hover:border-gray-500'
            } ${className}`}
          >
            {/* Draw checkmark inside using a spring animation */}
            <AnimatePresence>
              {checked && (
                <motion.svg
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="w-3.5 h-3.5 text-gray-900 stroke-current stroke-[3]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </motion.svg>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Text description representing what is being toggled */}
        <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
          {label}
        </span>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
