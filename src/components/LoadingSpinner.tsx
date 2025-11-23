
/**
 * @file LoadingSpinner.tsx
 * This component displays a loading spinner overlay, typically shown
 * when the application is waiting for an asynchronous operation to complete,
 * such as an API call to Gemini. It now accepts an optional message prop.
 */
import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  message?: string | null; // Optional message to display
}

/**
 * LoadingSpinner component.
 * Renders a full-screen overlay with an animated spinner and a loading message.
 * @param {LoadingSpinnerProps} props - The props for the component.
 * @returns {React.FC} The rendered LoadingSpinner component.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  const displayMessage = message || "Aralia is weaving fate...";
  return (
    <motion.div
      {...{
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 },
      } as any}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      aria-label="Loading content"
      role="status"
    >
      <div className="flex flex-col items-center">
        <div
          className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-500"
          aria-hidden="true"
        ></div>
        <p className="text-white text-xl mt-4 text-center px-4">{displayMessage}</p>
      </div>
    </motion.div>
  );
};

export default LoadingSpinner;
