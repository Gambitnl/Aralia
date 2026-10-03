/**
 * @file WizardStepper.tsx
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
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
export declare const WizardStepper: React.FC<WizardStepperProps>;
export {};
