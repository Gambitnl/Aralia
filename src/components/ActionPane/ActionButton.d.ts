import React from 'react';
import { Action } from '../../types';
interface ActionButtonProps {
    action: Action;
    onClick: (action: Action) => void;
    disabled: boolean;
    className?: string;
    isGeminiAction?: boolean;
    badgeCount?: number;
    hasNotification?: boolean;
    role?: string;
    tabIndex?: number;
    /** Optional inline styles for callers that need layout guarantees beyond shared button sizing. */
    style?: React.CSSProperties;
    /**
     * Optional shorter text to SHOW instead of `action.label` (e.g. "Talk" under a
     * person's name, where the name is already the group header). The full
     * `action` — including its real label — is still what gets dispatched, so log
     * messages and handlers are unaffected.
     */
    displayLabel?: string;
}
export declare const ActionButton: React.FC<ActionButtonProps>;
export {};
