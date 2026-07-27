import React from 'react';
export declare const getCategoryIcon: (category: string) => React.ReactNode;
export declare const highlightSearchTerm: (text: string, searchTerm: string) => React.ReactNode;
interface BreadcrumbProps {
    category: string;
    parentPath: string[];
    currentTitle: string;
    onNavigateToCategory?: () => void;
    onNavigateToParent?: (index: number) => void;
}
export declare const Breadcrumb: React.FC<BreadcrumbProps>;
/**
 * Category header color.
 *
 * Previously every category used a different saturated hue (red/green/teal/
 * indigo/purple/blue/orange/yellow/cyan/pink/amber) with no semantic meaning —
 * a rainbow that read as visual noise (GL6 / the app-wide X2 no-color-system
 * issue). The glossary now uses a single neutral accent for every category so
 * the headers read as one consistent system. Differentiation comes from the
 * per-category icon (getCategoryIcon), not from arbitrary color.
 */
export declare const getCategoryColor: (_category: string) => string;
export {};
