import React from 'react';
import { motion } from 'framer-motion';

export interface Step {
  id: string;
  label: string;
  isCompleted: boolean;
  isActive: boolean;
  isLocked: boolean;
}

interface WizardStepperProps {
  steps: Step[];
  onStepClick: (stepId: string) => void;
  className?: string;
}

/**
 * A horizontal stepper component.
 * Displays progress and allows navigation to unlocked steps.
 */
export const WizardStepper: React.FC<WizardStepperProps> = ({ steps, onStepClick, className = '' }) => {
  return (
    <div className={`flex items-center justify-between w-full px-4 py-2 ${className}`}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        return (
          <React.Fragment key={step.id}>
            {/* Step Circle */}
            <button
              onClick={() => !step.isLocked && onStepClick(step.id)}
              disabled={step.isLocked}
              className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 z-10 ${
                step.isActive
                  ? 'border-amber-500 bg-amber-900/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                  : step.isCompleted
                  ? 'border-sky-500 bg-sky-900/50 text-sky-400'
                  : 'border-gray-700 bg-gray-900 text-gray-500 cursor-not-allowed'
              }`}
              title={step.label}
            >
               {step.isCompleted && !step.isActive ? (
                <motion.svg 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }} 
                  className="w-4 h-4" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3"
                >
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              ) : (
                <span className="text-xs font-bold">{index + 1}</span>
              )}
              
              {/* Tooltip Label (Visible on Hover or Active) */}
              <div className={`absolute top-10 text-xs font-medium whitespace-nowrap transition-opacity duration-200 ${
                  step.isActive ? 'text-amber-400 opacity-100' : 'text-gray-500 opacity-0 group-hover:opacity-100'
              }`}>
                  {step.label}
              </div>
            </button>

            {/* Connector Line */}
            {!isLast && (
              <div className="flex-1 h-0.5 mx-2 bg-gray-800 relative">
                <motion.div 
                  className="absolute inset-0 bg-sky-600"
                  initial={{ width: '0%' }}
                  animate={{ width: step.isCompleted ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
