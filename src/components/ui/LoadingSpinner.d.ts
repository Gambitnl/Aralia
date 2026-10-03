/**
 * @file LoadingSpinner.tsx
 * This component displays a loading spinner overlay, typically shown
 * when the application is waiting for an asynchronous operation to complete,
 * such as an API call to Gemini. It now accepts an optional message prop.
 * @component-owner UI Team / Core UI
 *
 * DESIGN DECISION: Removed framer-motion dependency and replaced with vanilla
 * CSS transitions to eliminate massive frameworks from the initial Main Menu bundle.
 */
import React from 'react';
export interface LoadingSpinnerProps {
    message?: string | null;
}
/**
 * LoadingSpinner component.
 * Renders a full-screen overlay with an animated spinner and a loading message.
 * @param {LoadingSpinnerProps} props - The props for the component.
 * @returns {React.FC} The rendered LoadingSpinner component.
 */
export declare const LoadingSpinner: React.FC<LoadingSpinnerProps>;
