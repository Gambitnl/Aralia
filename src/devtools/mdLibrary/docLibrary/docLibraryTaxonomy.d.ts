/**
 * Document classification tables for the Markdown Document Library preview.
 *
 * PreviewMdLibrary.tsx uses these to render category and status badges, the filter
 * dropdowns, and the metadata editor selects. Keeping the taxonomy here keeps the
 * library component thin and lets the classes be reused or reviewed on their own.
 */
export declare const CATEGORIES: {
    id: string;
    label: string;
    color: string;
}[];
export declare const STATUSES: {
    id: string;
    label: string;
    color: string;
}[];
