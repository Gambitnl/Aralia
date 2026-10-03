/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/05/2026, 23:12:41
 * Dependents: md-library-entry.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Aralia Markdown Document Library Tool
 *
 * This file implements the main user interface for the Markdown Document Library.
 * It is a premium developer tool that allows Remy to browse, search, classify,
 * edit, and safely retire or delete markdown files across the entire Aralia codebase.
 * It interfaces with Vite dev server middleware endpoints (/api/docs/*) and
 * keeps the central document status board (@DOC-REVIEW-LEDGER.md) completely in sync.
 *
 * Designed with a sleek, glassmorphic dark mode, Outfit and JetBrains Mono typography,
 * high-fidelity micro-interactions, responsive side-by-side editing, and a custom
 * visual safety validation checklist for file deletion.
 *
 * Called by: src/md-library-entry.tsx
 * Depends on: F:/Repos/Aralia/docs/registry/@DOC-REVIEW-LEDGER.md (for ledger updates)
 */
import React from 'react';
export declare const PreviewMdLibrary: React.FC;
