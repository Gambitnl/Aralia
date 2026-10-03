/**
 * @file BackgroundDetailPane.tsx
 * Detailed view of a selected background, designed for the right pane of the Split Config layout.
 */
import React from 'react';
import { Background } from '../../data/backgrounds';
interface BackgroundDetailPaneProps {
    background: Background;
    onSelect: () => void;
}
export declare const BackgroundDetailPane: React.FC<BackgroundDetailPaneProps>;
export {};
