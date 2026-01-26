import React, { forwardRef } from 'react';

// Since I haven't confirmed 'cn' exists, I will use a simple helper or just template literals if I can't find it.
// Checking file listing earlier, I didn't verify utils. Let me check for a utils folder or just use simple string concat for now to be safe,
// or check if 'cn' or 'clsx' is used elsewhere.
// Wait, I should verify if 'cn' exists. If not, I'll stick to standard template literals or create it.
// React.HTMLAttributes is standard.

/**
 * Standard Table Container
 * Wraps the table in the "premium" rounded styling.
 */
export const TableContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
        <div
            ref={ref}
            className={`overflow-hidden rounded-lg border border-gray-600 shadow-lg bg-gray-900/40 ${className || ''}`}
            {...props}
        >
            {children}
        </div>
    )
);
TableContainer.displayName = 'TableContainer';

/**
 * Standard Table Element
 */
export const Table = forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
    ({ className, children, ...props }, ref) => (
        <table
            ref={ref}
            className={`w-full text-left text-xs bg-black/20 rounded border-collapse [&_p]:m-0 [&_p]:leading-relaxed ${className || ''}`}
            {...props}
        >
            {children}
        </table>
    )
);
Table.displayName = 'Table';

/**
 * standard Table Head
 */
export const TableHeader = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, children, ...props }, ref) => (
        <thead
            ref={ref}
            className={`${className || ''}`}
            {...props}
        >
            {children}
        </thead>
    )
);
TableHeader.displayName = 'TableHeader';

/**
 * Standard Table Body
 */
export const TableBody = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, children, ...props }, ref) => (
        <tbody
            ref={ref}
            className={`divide-y divide-gray-700/30 ${className || ''}`}
            {...props}
        >
            {children}
        </tbody>
    )
);
TableBody.displayName = 'TableBody';

/**
 * Standard Table Row
 */
export const TableRow = forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
    ({ className, children, ...props }, ref) => (
        <tr
            ref={ref}
            className={`hover:bg-gray-800/50 transition-colors group ${className || ''}`}
            {...props}
        >
            {children}
        </tr>
    )
);
TableRow.displayName = 'TableRow';

/**
 * Standard Table Head Cell (Th)
 */
export const TableHead = forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
    ({ className, children, ...props }, ref) => (
        <th
            ref={ref}
            className={`py-3 px-4 font-semibold text-amber-300 uppercase tracking-wider border-b border-gray-600 ${className || ''}`}
            {...props}
        >
            {children}
        </th>
    )
);
TableHead.displayName = 'TableHead';

/**
 * Standard Table Cell (Td)
 */
export const TableCell = forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
    ({ className, children, ...props }, ref) => (
        <td
            ref={ref}
            className={`py-3 px-4 text-gray-300 align-top ${className || ''}`}
            {...props}
        >
            {children}
        </td>
    )
);
TableCell.displayName = 'TableCell';
