---
name: Maintain Icon System
description: Advanced workflow for auditing, sourcing, adding, and configuring icons using the Design Preview tools and MDI library. 
---

# Maintain Icon System Skill

This skill outlines the comprehensive workflow for maintaining the Aralia icon system. It covers identifying needs, sourcing assets (specifically from Material Design Icons), implementing them in the registry, and configuring their status (Regular, Selected, Deprecated, Update) using the Design Preview UI.

## Workflow Overview

1.  **Audit & Identify**: Use the Design Preview to see what's missing or needs updating.
2.  **Source Assets**: Find the SVG path data for the desired icon.
3.  **Implement**: Register the icon in `IconRegistry.tsx`.
4.  **Categorize**: Add the icon to the appropriate category in `PreviewIcons.tsx`.
5.  **Configure**: Use the Design Preview UI to generate the configuration (Selected/Deprecated) and apply it.

## Step-by-Step Instructions

### 1. Audit & Identify
- Open the Design Preview (e.g., `http://localhost:3000/misc/design.html`).
- **Missing Icons Report**: Navigate to the **Missing Icons** tab. This automated report scans the glossary and lists any traits using the fallback icon (`auto_awesome`) or invalid paths.
- **Visual Audit**: Navigate to the **Icons** tab. Switch the **"Show Outlines"** toggle to check for missing outline variants (indicated by a red warning sign).
- **Manual Check**: Review the glossary pages or specific components to identify missing visual metaphors.

### 2. Source Assets
Arala uses **Material Design Icons (MDI)** as the primary source.

**Option A: Raw SVG (Reliable)**
- Visit the valid source of truth: `https://raw.githubusercontent.com/Templarian/MaterialDesign/master/svg/<icon-name>.svg`.
- Copy the SVG content.
- Ensure the viewBox is `0 0 24 24`.

**Option B: Web Search**
- Visit [Pictogrammers MDI Library](https://pictogrammers.com/library/mdi/).
- Search for the icon (e.g., "sword", "shield", "flower").
- Copy the **SVG Path** data. *Note: Data from the web UI sometimes matches a different viewBox.*

### 3. Implement in Registry
- Open `src/components/Glossary/IconRegistry.tsx`.
- Add the new icon key and SVG structure to the `icons` object.
- **Convention**:
  - Use `snake_case` for the key (e.g., `account_box_outline`).
  - Use strictly `viewBox="0 0 24 24"` and `fill="currentColor"`.
  ```tsx
  my_new_icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M..." />
      </svg>
  ),
  ```
- **Pre-Validation (Critical)**:
  - Before adding, **ALWAYS** search the file for the icon key to prevent duplicates.
  - Use `Select-String` (PowerShell) or `grep`:
    ```powershell
    Select-String -Path src/components/Glossary/IconRegistry.tsx -Pattern "my_new_icon"
    ```
  - *If it exists*: Update the existing definition instead of adding a new one. Duplicate keys can cause silent failures or persistent old icons.

- **Post-Edit Verification**:
  - After editing, read the file again to ensure your changes were actually applied.
  - Check for the presence of the new SVG code.
  - Open `src/components/Glossary/GlossaryTraitTable.tsx`.
  - Add the new icon name to the `VALID_ICONS` Set. *Crucial: Without this, the system will not recognize the icon string and will use the fallback.*

### 4. Categorize & Validate
- Open `src/components/DesignPreview/steps/PreviewIcons.tsx`.
- Add the new icon key to the appropriate list in `CATEGORIZED_ICONS` (e.g., `'Weapons'`, `'Nature & Elements'`, etc.).
- If adding a specific game concept (e.g., a specific Condition), update the specific array (e.g., `CONDITION_ICONS`).
- **Verify**: The icon should now appear in the Design Preview grid.

### 5. Configure Status (Selected / Deprecated)
This step defines which icons are "Active" (Green) vs "Deprecated" (Red) vs "Update Candidates" (Blue).

- In the **Design Preview UI**:
  - **Click** an icon to cycle its status:
    - **Normal** (Gray) -> **Selected** (Green) -> **Deprecated** (Red) -> **Update** (Blue) -> **Normal**.
  - Adjust the grid until it reflects the desired state.
- **Export Configuration**:
  - Click the **"Copy Changes"** button in the header.
  - This copies a code snippet to your clipboard (e.g., `// ADD to SELECTED: foo, bar`).
- **Apply Configuration**:
  - Paste the snippet into `src/components/DesignPreview/steps/PreviewIcons.tsx` to update the `INITIAL_SELECTED`, `INITIAL_DEPRECATED`, or `INITIAL_UPDATE` sets.
  - *Tip: The agent can perform this update for you if you provide the snippet.*

## Best Practices
- **Outlines**: Always try to add both the filled and `_outline` variant for consistency.
- **Naming**: MDI icons often have long names. You can map them to simpler keys in `IconRegistry` (e.g., mapping `mdiHumanMaleBoard` to `worker`).
- **Consistency**: Stick to MDI/Google icons first. Avoid mixing styles (e.g., thin strokes vs thick strokes) if possible.

## Troubleshooting

### Icon Showing as Text (Fallback)
- **Cause**: The icon key is missing from the `IconRegistry` `icons` object, or there's a typo in the key.
- **Fix**: Verify the key in `IconRegistry.tsx` matches the string used in code exactly. Search the file to ensure the definition isn't commented out or missing.

### Icon Not Updating
- **Cause**: Duplicate keys in `IconRegistry.tsx`. The last defined key wins in JS execution, but duplicates can confuse tools and static analysis.
- **Fix**: Search for the key string in `IconRegistry.tsx`. If multiple matches found, delete the outdated ones.

### Code Tool Failed but Reported Success
- **Cause**: LLM tool misuse (e.g., replace block mismatch).
- **Fix**: Always perform a `view_file` or `grep` after a `replace_file_content` to verify the state of the code on disk.

## Command Line Tips (Windows/PowerShell)

When performing maintenance tasks via the terminal, be aware of the following platform quirks:

-   **`rm` vs `Remove-Item`**:
    -   In PowerShell, `rm` is an alias for `Remove-Item`.
    -   Unlike Unix `rm`, it **does not** accept space-separated lists of files (e.g., `rm file1 file2`).
    -   **Fix**: Use comma separation (`rm file1, file2`) or delete files individually.

-   **`grep`**:
    -   `grep` is not natively available in standard Windows terminals.
    -   **Fix**: Use `Select-String` (e.g., `Select-String -Path file.txt -Pattern "foo"`) or use the VS Code search tools.

-   **Raw GitHub URLs**:
    -   When fetching assets, always prefer `raw.githubusercontent.com` URLs over web UI URLs to ensure you get clean, processing-free content (correct viewBox, no extra metadata).
