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
  isStepCompleted,
  SidebarStepConfig,
} from './config/sidebarSteps';

interface CreationSidebarProps {
  currentStep: CreationStep;
  state: CharacterCreationState;
  onNavigateToStep: (step: CreationStep) => void;
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
  const isComplete = isStepCompleted(config.step, state);
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
        w-full flex items-center gap-3 py-2 px-3 rounded-md text-left transition-colors
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
const GroupHeader: React.FC<{ group: StepGroup }> = ({ group }) => {
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
}) => {
  // Get visible steps
  const visibleSteps = SIDEBAR_STEPS.filter(step => step.isVisible(state));

  return (
    <aside
      className="w-64 bg-gray-850 border-r border-gray-700 flex flex-col h-full hidden md:flex"
      aria-label="Character creation progress"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-amber-400">Progress</h2>
      </div>

      {/* Step list */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {visibleSteps.map((stepConfig, index) => (
          <SidebarStepRow
            key={stepConfig.step}
            config={stepConfig}
            currentStep={currentStep}
            state={state}
            onNavigate={onNavigateToStep}
            index={index + 1}
          />
        ))}
      </nav>

      {/* Footer with completion status */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500">
          {visibleSteps.filter(s => isStepCompleted(s.step, state)).length} / {visibleSteps.length} steps complete
        </div>
      </div>
    </aside>
  );
};

export default CreationSidebar;
