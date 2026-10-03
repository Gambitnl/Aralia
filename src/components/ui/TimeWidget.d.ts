/**
 * @file TimeWidget.tsx
 *
 * @component-owner Gameplay Team / Core UI
 */
import React from 'react';
interface TimeWidgetProps {
    gameTime: Date;
    onPassTimeClick?: () => void;
    disabled?: boolean;
}
export declare const TimeWidget: React.FC<TimeWidgetProps>;
export {};
