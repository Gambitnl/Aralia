import React from 'react';
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
export declare const CreationStepLayout: React.FC<CreationStepLayoutProps>;
