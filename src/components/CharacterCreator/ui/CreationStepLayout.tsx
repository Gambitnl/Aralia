import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/Button';

export interface CreationStepLayoutProps {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  canProceed?: boolean;
  nextLabel?: string;
  backLabel?: string;
  className?: string;
  /** Optional custom confirm button (replaces default Next button in header) */
  customNextButton?: React.ReactNode;
  /** Optional additional actions to show in the header (e.g. Reset, Randomize) */
  headerActions?: React.ReactNode;
  /** Allow disabling the outer scroll container so inner panes can scroll independently. */
  bodyScrollable?: boolean;
}

/**
 * Standard layout for Character Creation steps.
 * Header-based navigation: Back button (left), Title (center), Next button (right).
 * No footer - all navigation is in the header to maximize content space.
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
  customNextButton,
  headerActions,
  bodyScrollable = true,
}) => {
  return (
    <div className={`flex flex-col h-full w-full ${className}`}>
      {/* Header with Navigation */}
      <div className="flex-shrink-0 p-4 sm:p-6 pb-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back Button */}
          <div className="flex-1 flex justify-start">
            {onBack && (
              <Button
                variant="secondary"
                size="md"
                onClick={onBack}
              >
                {backLabel}
              </Button>
            )}
          </div>

          {/* Center: Title */}
          <div className="text-center flex-shrink-0">
            <h2 id="creation-step-title" className="text-2xl sm:text-3xl text-sky-300 font-cinzel font-bold tracking-wide drop-shadow-sm">
              {title}
            </h2>
            <div className="h-0.5 w-24 sm:w-32 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent mx-auto mt-2" aria-hidden="true" />
          </div>

          {/* Right: Next Button or Custom Button + Utility Actions */}
          <div className="flex-1 flex justify-end items-center gap-2">
            {headerActions}
            
            {customNextButton ? (
              customNextButton
            ) : onNext ? (
              <Button
                variant="primary"
                size="md"
                onClick={onNext}
                disabled={!canProceed}
                aria-label={nextLabel}
              >
                {nextLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Scrollable Body - maximized space without footer */}
      <div
        className={`flex-grow px-4 sm:px-6 py-4 scrollable-content border border-gray-700 rounded-xl ${
          bodyScrollable ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
        role="region"
        aria-labelledby="creation-step-title"
      >
        <motion.div
          className={bodyScrollable ? '' : 'h-full min-h-0'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
};
