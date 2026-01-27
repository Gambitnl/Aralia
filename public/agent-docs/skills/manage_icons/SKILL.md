---
name: Manage Icons
description: Instructions for adding, updating, auditing, and configuring icons in the Aralia codebase using MDI and Google Material Symbols.
---

# Manage Icons Skill

This skill covers the complete workflow for managing icons in Aralia, from adding a single icon to auditing the entire system.

## Quick Reference: Add a New Icon

1.  **Pre-Validate** (Critical): Search for duplicates first.
    ```powershell
    Select-String -Path src/components/Glossary/IconRegistry.tsx -Pattern "my_new_icon"
    ```
2.  **Source**: Get the SVG path from MDI GitHub:
    `https://raw.githubusercontent.com/Templarian/MaterialDesign/master/svg/<icon-name>.svg`
3.  **Register**: Add to `src/components/Glossary/IconRegistry.tsx` in the `icons` object.
4.  **Validate**: Add to `VALID_ICONS` Set in `src/components/Glossary/GlossaryTraitTable.tsx`.
5.  **Verify**: Check the Design Preview → Icons tab.

---

## Detailed Instructions

### 1. Audit & Identify Missing Icons
- Open the Design Preview (`http://localhost:3000/misc/design.html`).
- **Missing Icons Tab**: Lists traits using fallback icons or invalid paths.
- **Icons Tab**: Toggle "Show Outlines" to find missing `_outline` variants.

### 2. Source Assets
Aralia uses **Material Design Icons (MDI)** and **Google Material Symbols**.

| Source | URL | Notes |
|--------|-----|-------|
| MDI Raw SVG | `https://raw.githubusercontent.com/Templarian/MaterialDesign/master/svg/<name>.svg` | Most reliable, `0 0 24 24` viewBox |
| MDI Web UI | [pictogrammers.com/library/mdi/](https://pictogrammers.com/library/mdi/) | Copy path data |
| Material Symbols | `https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/<name>/materialsymbolsoutlined/<name>_24px.svg` | Uses `0 -960 960 960` viewBox |

### 3. Implement in Registry
```tsx
// src/components/Glossary/IconRegistry.tsx
my_new_icon: (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M..." />
    </svg>
),
```
- Use `snake_case` for keys.
- Use `viewBox="0 0 24 24"` for MDI, or `viewBox="0 -960 960 960"` for Material Symbols.

### 4. Add to VALID_ICONS
```tsx
// src/components/Glossary/GlossaryTraitTable.tsx
export const VALID_ICONS = new Set([
    // ... existing icons
    'my_new_icon',
]);
```

### 5. Categorize in Design Preview (Optional)
Add to the appropriate category in `src/components/DesignPreview/steps/PreviewIcons.tsx`:
```tsx
'Nature & Elements': ['tree', 'flower', 'my_new_icon'],
```

### 6. Configure Status (Optional)
In the Design Preview UI:
- **Click** an icon to cycle: Normal → Selected (Green) → Deprecated (Red) → Update (Blue).
- Click **"Copy Changes"** to export the configuration.
- Apply to `INITIAL_SELECTED`, `INITIAL_DEPRECATED`, or `INITIAL_UPDATE` sets in `PreviewIcons.tsx`.

---

## How to Use Icons

**In Glossary Data (JSON):**
```json
{ "icon": "flower", "name": "Nature's Gift", "description": "..." }
```

**In Code:**
```tsx
<GlossaryIcon icon="flower" className="w-6 h-6 text-red-500" />
```

---

## Critical Safeguards

### Pre-Validation (Before Adding)
```powershell
Select-String -Path src/components/Glossary/IconRegistry.tsx -Pattern "icon_name"
```
*If it exists*: Update the existing definition. Duplicate keys cause silent failures.

### Post-Edit Verification
After editing, **read the file back** to confirm changes were applied. Check for:
-   Presence of the new SVG code in `IconRegistry.tsx`.
-   Icon name in `VALID_ICONS` set.
-   **No fallback rendering** in Design Preview (icon shows as graphic, not text).

---

## Troubleshooting

### Icon Showing as Text (Fallback)
- **Cause**: Icon key missing from `IconRegistry.tsx` or typo in key.
- **Fix**: Search the file to ensure the definition exists.

### Icon Not Updating / Old Version Persists
- **Cause**: Duplicate keys in `IconRegistry.tsx`.
- **Fix**: Search for the key. Delete outdated duplicates.

### Code Edit Tool Failed Silently
- **Cause**: Tool mismatch (content not found).
- **Fix**: Always `view_file` after edits to verify state on disk.

---

## Command Line Tips (Windows/PowerShell)

| Problem | Solution |
|---------|----------|
| `rm file1 file2` fails | Use `rm file1, file2` (comma-separated) |
| `grep` not found | Use `Select-String -Path file -Pattern "text"` |
| SVG has wrong viewBox | Use raw GitHub URLs, not web UI |
