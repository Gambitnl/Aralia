---
name: Manage Icons
description: Instructions for adding, updating, and using icons in the Aralia codebase, specifically using the MDI library.
---

# Manage Icons Skill

This skill outlines the process for managing icons within the Aralia application, specifically focusing on the `IconRegistry` and `GlossaryTraitTable`.

## Overview
Icons in Aralia are primarily sourced from the Material Design Icons (MDI) library. They are defined as SVG paths in `src/components/Glossary/IconRegistry.tsx` and validated via `GlossaryTraitTable.tsx`.

## How to Add a New Icon

1.  **Find the Icon:**
    *   Visit [pictogrammers.com/library/mdi/](https://pictogrammers.com/library/mdi/) to find the desired icon.
    *   Get the SVG path data (usually begins with `M...` and ends with `Z`).
    *   Ensure the path is for a standard 24x24 viewbox. If fetching directly from the source, the raw SVG file at `https://raw.githubusercontent.com/Templarian/MaterialDesign/master/svg/<icon-name>.svg` is the most reliable source.

2.  **Clone the Icon (Optional - for Outlines):**
    *   If you are adding a filled icon, checking for an `_outline` variant is recommended for completeness.

3.  **Update `IconRegistry.tsx`:**
    *   Open `src/components/Glossary/IconRegistry.tsx`.
    *   Add the new icon name and SVG path to the `icons` object.
    *   Format: `'icon_name': <path d="..." />`.

4.  **Update "Update Instruction" (`VALID_ICONS`):**
    *   Open `src/components/Glossary/GlossaryTraitTable.tsx`.
    *   Add the new icon name string to the `VALID_ICONS` Set.
    *   **What this does:** This step is the "Update Instruction". It tells the application (specifically the `getTraitIcon` parser) that this string is now a valid, renderable icon. Without this, the system might treat the icon name as invalid and fallback to default (sparkles).

## How to Use Icons

-   **In Glossary Data:**
    *   Use the icon name in your JSON data: `"icon": "flower"`.
-   **In Code:**
    *   Use the `GlossaryIcon` component:
        ```tsx
        <GlossaryIcon icon="flower" className="w-6 h-6 text-red-500" />
        ```

## Verification

-   Visit the **Design Preview** page (e.g., `http://localhost:3000/misc/design.html`).
-   Navigate to the **Icons** tab to see all registered icons.
-   Navigate to the **Missing Icons** tab to confirm your new icon is recognized.
