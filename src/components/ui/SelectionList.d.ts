/**
 * @file SelectionList.tsx
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
interface SelectionListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    selected?: boolean;
    rightContent?: React.ReactNode;
    icon?: React.ReactNode;
}
/**
 * Standard List Item for Selection Panes (Race, Class lists).
 * Used in SplitPaneLayout controls.
 */
export declare const SelectionListItem: React.FC<SelectionListItemProps>;
export {};
