/**
 * Lightweight toast system that replaces browser alerts and provides
 * non-blocking feedback to the player.
 *
 * On compact play screens, notifications sit in a smaller lower-left stack so
 * stacked quest feedback does not cover the main action buttons. Desktop keeps
 * the broader top-corner treatment.
 * @component-owner UI Team / Core UI
 */
import React from 'react';
import { Notification } from '../../types';
import type { AppAction } from '../../state/actionTypes';
interface NotificationSystemProps {
    notifications: Notification[];
    dispatch: React.Dispatch<AppAction>;
}
export declare const NotificationSystem: React.FC<NotificationSystemProps>;
export {};
