/**
 * Document classification tables for the Markdown Document Library preview.
 *
 * PreviewMdLibrary.tsx uses these to render category and status badges, the filter
 * dropdowns, and the metadata editor selects. Keeping the taxonomy here keeps the
 * library component thin and lets the classes be reused or reviewed on their own.
 */

export const CATEGORIES = [
  { id: 'index', label: 'Index & Homepages', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { id: 'reference', label: 'Reference & Domain Maps', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'workflow', label: 'Workflows & Guides', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { id: 'work-item', label: 'Active Work & Checklist', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { id: 'archive', label: 'Archive & History', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { id: 'registry', label: 'Registry & Ledger', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'other', label: 'Unclassified / Other', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' }
];

export const STATUSES = [
  { id: 'not started', label: 'Not Started', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  { id: 'in review', label: 'In Review', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  { id: 'reviewed', label: 'Reviewed', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { id: 'updated', label: 'Updated', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'processed', label: 'Processed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'archived', label: 'Archived', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' }
];
