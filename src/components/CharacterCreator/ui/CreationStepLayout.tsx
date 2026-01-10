import React from 'react';
import { motion } from 'framer-motion';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../../styles/buttonStyles';

export interface CreationStepLayoutProps {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  canProceed?: boolean;
  nextLabel?: string;
  backLabel?: string;
  className?: string;
  /** Optional custom confirm button (e.g., for Race selection) */
  raceConfirmButton?: React.ReactNode;
}

/**
 * Standard layout for Character Creation steps.
 * Provides a consistent Header (Title) - Body (Scrollable) - Footer (Buttons) structure.
 */
export const CreationStepLayout: React.FC<CreationStepLayoutProps> = ({
  title,
  children,
  onBack,
  onNext,
  canProceed = true,
  nextLabel = 'Next',
  backLabel = 'Back',
  className = '',
  raceConfirmButton,
}) => {
  return (
    <div className={`flex flex-col h-full w-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 sm:p-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1" /> {/* Spacer for centering */}
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl text-sky-300 font-cinzel font-bold tracking-wide drop-shadow-sm">
              {title}
            </h2>
            <div className="h-0.5 w-24 sm:w-32 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent mx-auto mt-2" />
          </div>
          <div className="flex-1 flex justify-end">
            {raceConfirmButton}
          </div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-grow overflow-y-auto px-4 sm:px-6 py-4 scrollable-content border border-gray-700 rounded-xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </div>

      {/* Footer Controls */}
      {(onBack || onNext) && (
        <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t border-gray-700/50 bg-gray-800/95 backdrop-blur-sm mt-auto">
          <div className="flex gap-4 max-w-2xl mx-auto">
            {onBack && (
              <button
                onClick={onBack}
                className={`${BTN_SECONDARY} flex-1 py-3 text-lg rounded-xl shadow-lg hover:shadow-gray-900/50 transition-all`}
              >
                {backLabel}
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                disabled={!canProceed}
                className={`${BTN_PRIMARY} flex-[2] py-3 text-lg rounded-xl shadow-lg hover:shadow-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] transition-all`}
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
