// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:26:55
 * Dependents: CharacterCreator.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file CreationSidebar.tsx
 * Persistent left sidebar for character creation, showing step progress,
 * current selections, and allowing navigation between steps.
 * Inspired by Baldur's Gate 3's character creation UI.
 */
import React from 'react';
import { CreationStep, CharacterCreationState } from './state/characterCreatorState';
import {
  SIDEBAR_STEPS,
  STEP_GROUPS,
  StepGroup,
  isStepReachedAndComplete,
  SidebarStepConfig,
} from './config/sidebarSteps';

interface CreationSidebarProps {
  currentStep: CreationStep;
  state: CharacterCreationState;
  onNavigateToStep: (step: CreationStep) => void;
  /** Wipes every choice and returns to the Race step (two-click confirm). */
  onStartOver?: () => void;
}

/**
 * Step indicator icon based on completion status
 */
const StepIndicator: React.FC<{
  isComplete: boolean;
  isCurrent: boolean;
  isClickable: boolean;
}> = ({ isComplete, isCurrent, isClickable }) => {
  if (isComplete) {
    return (
      <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (isCurrent) {
    return (
      <div className="w-5 h-5 rounded-full bg-sky-500 ring-2 ring-sky-300 ring-offset-1 ring-offset-gray-800 flex-shrink-0" />
    );
  }

  return (
    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
      isClickable ? 'border-gray-500' : 'border-gray-600'
    }`} />
  );
};

/**
 * Individual step row in the sidebar
 */
const SidebarStepRow: React.FC<{
  config: SidebarStepConfig;
  currentStep: CreationStep;
  state: CharacterCreationState;
  onNavigate: (step: CreationStep) => void;
  index: number;
}> = ({ config, currentStep, state, onNavigate, index }) => {
  // Use the same "reached AND complete" rule the footer count uses, so a green
  // check never appears on a step the tally won't credit (e.g. a later step
  // with defaults that the player hasn't visited yet).
  const isComplete = isStepReachedAndComplete(config.step, currentStep, state);
  const isCurrent = currentStep === config.step;
  const isNested = config.parentStep !== undefined;

  // Steps are always navigable (except the current step), regardless of completion.
  const canNavigate = !isCurrent;

  const summary = config.getSelectionSummary(state);

  const handleClick = () => {
    if (canNavigate) {
      onNavigate(config.step);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!canNavigate}
      className={`
        w-full min-h-11 flex items-center gap-3 py-2 px-3 rounded-md text-left transition-colors
        ${isNested ? 'ml-4' : ''}
        ${isCurrent ? 'bg-gray-700/50' : ''}
        ${canNavigate ? 'hover:bg-gray-700/70 cursor-pointer' : 'cursor-default'}
      `}
      aria-current={isCurrent ? 'step' : undefined}
      aria-label={`${index}. ${config.label}${summary ? `: ${summary}` : ''}${isComplete ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
    >
      <StepIndicator
        isComplete={isComplete}
        isCurrent={isCurrent}
        isClickable={canNavigate}
      />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${
          isCurrent ? 'text-sky-300' : isComplete ? 'text-gray-200' : 'text-gray-400'
        }`}>
          {index}. {config.label}
        </div>
        {summary && (
          <div className="text-xs text-gray-400 truncate ml-1 opacity-80">
            {summary}
          </div>
        )}
      </div>
    </button>
  );
};

/**
 * Group header in the sidebar
 */
const _GroupHeader: React.FC<{ group: StepGroup }> = ({ group }) => {
  const { label } = STEP_GROUPS[group];

  return (
    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}
    </div>
  );
};

/**
 * Main sidebar component
 */
const CreationSidebar: React.FC<CreationSidebarProps> = ({
  currentStep,
  state,
  onNavigateToStep,
  onStartOver,
}) => {
  const currentStepRowRef = React.useRef<HTMLDivElement | null>(null);
  const stepListRef = React.useRef<HTMLElement | null>(null);
  // Get visible steps
  const visibleSteps = SIDEBAR_STEPS.filter(step => step.isVisible(state));
  // Progress should reflect the route the player has actually reached. Several
  // later steps have defaults, so counting every completed visible step makes
  // one confirmed choice look like multiple choices were finished. This shares
  // the exact predicate the green checkmarks use (isStepReachedAndComplete), so
  // the footer tally and the number of checks can never disagree.
  const completedReachedSteps = visibleSteps.filter(stepConfig =>
    isStepReachedAndComplete(stepConfig.step, currentStep, state)
  ).length;

  // Two-click confirm for the destructive Start Over action. The armed state
  // disarms automatically so a stray first click can't linger as a landmine.
  const [confirmingReset, setConfirmingReset] = React.useState(false);
  React.useEffect(() => {
    if (!confirmingReset) return;
    const timer = setTimeout(() => setConfirmingReset(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingReset]);

  const handleStartOverClick = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setConfirmingReset(false);
    onStartOver?.();
  };

  React.useEffect(() => {
    // Auto-Fill can jump from the first step to review, adding optional steps
    // along the way. Keep the active step visible in the scrollable progress
    // list without asking the browser to scroll any outer window ancestors.
    const currentRow = currentStepRowRef.current;
    const stepList = stepListRef.current;
    if (!currentRow || !stepList) return;

    // offsetTop can be measured against an outer positioned creator panel
    // instead of this nav. Subtract the nav's own top edge so the scroll math
    // only considers the row's position inside the progress list viewport.
    const rowTop = Math.max(0, currentRow.offsetTop - stepList.offsetTop);
    const rowBottom = rowTop + currentRow.offsetHeight;
    const visibleTop = stepList.scrollTop;
    const visibleBottom = visibleTop + stepList.clientHeight;

    if (rowTop < visibleTop) {
      stepList.scrollTop = rowTop;
    } else if (rowBottom > visibleBottom) {
      stepList.scrollTop = Math.max(0, rowBottom - stepList.clientHeight);
    }
  }, [currentStep, visibleSteps.length]);

  return (
    <aside
      className="flex h-[52%] min-h-56 w-full shrink-0 flex-col border-b border-gray-700 bg-gray-850 sm:h-full sm:min-h-0 sm:w-64 sm:border-b-0 sm:border-r"
      aria-label="Character creation progress"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-amber-400">Progress</h2>
      </div>

      {/* Step list */}
      <nav ref={stepListRef} className="flex-1 overflow-y-auto p-2 space-y-1" data-testid="creation-sidebar-steps">
        {visibleSteps.map((stepConfig, index) => (
          <div
            key={stepConfig.step}
            ref={stepConfig.step === currentStep ? currentStepRowRef : null}
            data-testid={stepConfig.step === currentStep ? 'creation-sidebar-current-step' : undefined}
          >
            <SidebarStepRow
              config={stepConfig}
              currentStep={currentStep}
              state={state}
              onNavigate={onNavigateToStep}
              index={index + 1}
            />
          </div>
        ))}
      </nav>

      {/* Footer with completion status */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        <div className="text-xs text-gray-500">
          {completedReachedSteps} / {visibleSteps.length} steps complete
        </div>
        {onStartOver && (
          <button
            type="button"
            onClick={handleStartOverClick}
            className={`w-full min-h-11 text-xs rounded-md px-2 py-2 border transition-colors ${
              confirmingReset
                ? 'bg-red-900/50 border-red-500 text-red-200 hover:bg-red-800/60'
                : 'bg-transparent border-gray-600 text-gray-400 hover:border-red-500/60 hover:text-red-300'
            }`}
            aria-label={confirmingReset ? 'Confirm: erase all choices and start over' : 'Start over'}
          >
            {confirmingReset ? 'Erase all choices?' : '↺ Start Over'}
          </button>
        )}
      </div>
    </aside>
  );
};

export default CreationSidebar;
