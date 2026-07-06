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
  /**
   * Why the Next/Confirm button is currently blocked. Rendered as a visible
   * hint under the header so users aren't left guessing at a disabled button
   * whose explanation only exists in a hover tooltip (GAPS.md G11).
   */
  blockedReason?: string | null;
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
  blockedReason = null,
}) => {
  return (
    <div className={`flex flex-col h-full w-full ${className}`}>
      {/* Header with Navigation */}
      <div className="flex-shrink-0 p-4 sm:p-6 pb-2">
        {/* The creator often sits beside the progress rail, so the content pane can
            be narrower than the viewport. Stack the title above the navigation
            actions until there is enough horizontal room for the three-part row. */}
        <div
          className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center"
          data-testid="creation-step-header"
        >
          {/* Left: Back Button */}
          <div className="order-2 min-w-0 flex justify-start xl:order-1">
            {onBack && (
              // The header buttons sit at the edge of a scrollable creator pane, so
              // they keep the same 44px hit target as the main creator controls.
              <Button
                variant="secondary"
                size="md"
                onClick={onBack}
                className="min-h-11"
              >
                {backLabel}
              </Button>
            )}
          </div>

          {/* Center: Title */}
          <div className="order-1 col-span-2 min-w-0 text-center xl:order-2 xl:col-span-1">
            <h2 id="creation-step-title" className="text-2xl sm:text-3xl text-sky-300 font-cinzel font-bold tracking-wide drop-shadow-sm break-words">
              {title}
            </h2>
            <div className="h-0.5 w-24 sm:w-32 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent mx-auto mt-2" aria-hidden="true" />
          </div>

          {/* Right: Next Button or Custom Button + Utility Actions */}
          <div className="order-3 min-w-0 flex justify-end items-center gap-2 xl:order-3">
            {headerActions}
            
            {customNextButton ? (
              customNextButton
            ) : onNext ? (
              // Step advancement is a primary player action; keep it large enough
              // to survive narrow panes, browser zoom, and translated labels.
              <Button
                variant="primary"
                size="md"
                onClick={onNext}
                disabled={!canProceed}
                aria-label={nextLabel}
                title={!canProceed && blockedReason ? blockedReason : nextLabel}
                className="min-h-11"
              >
                {nextLabel}
              </Button>
            ) : null}
          </div>
        </div>

        {blockedReason && (
          <p
            className="text-right text-xs text-amber-300/90 mt-1.5 pr-1"
            role="status"
          >
            {blockedReason}
          </p>
        )}
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
