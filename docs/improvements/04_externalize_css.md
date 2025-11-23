- [x] Plan Completed

# Plan: Externalize CSS from `index.html`

## 1. Purpose & Problem Statement

**Problem:** The application's custom CSS styles are currently embedded directly within a `<style>` block in `index.html`. This violates the principle of separation of concerns, mixing presentation logic directly into the document structure. This approach hinders maintainability, readability, and prevents the use of standard development tools for CSS linting and formatting. It also negatively impacts performance by preventing the browser from caching the stylesheet independently.

**Goal:** Refactor the application to use a dedicated, external stylesheet. This will improve code organization, developer experience, and browser caching performance, aligning the project with professional web development standards.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including envisioned file/folder structures and general code direction.
-   When code is envisioned, it will be heavily accompanied by comments explaining its function and dependencies.

---

## 3. Architectural Context: Why `/public`?

In this project's unique no-build-tool architecture, the `src/` directory is not directly served or processed by a web server. Only files placed within the `/public` directory are guaranteed to be accessible via root-relative paths from the browser.

Therefore, the new stylesheet **must** be placed in `/public` (e.g., `public/styles.css`) so that it can be correctly referenced in `index.html` with `<link href="/styles.css">`.

---

## 4. Implementation Plan

### Phase 1: Create and Populate the External Stylesheet

-   [x] **Topic: Create New File**
    -   **Action**: Create a new file at the following path: `public/styles.css`.
    -   **Code Suggestion**: This is a file system action, no code to show.

-   [x] **Topic: Add Comment Header**
    -   **Action**: Add a comment header to the new `public/styles.css` file for documentation.
    -   **Code Suggestion**:
        ```css
        /* 
         * public/styles.css
         *
         * This file contains all custom, non-utility CSS for the Aralia RPG application.
         * It is loaded directly by index.html and styles elements beyond what is covered
         * by the Tailwind CSS utility classes.
         */
        ```

-   [x] **Topic: Copy and Paste Content**
    -   **Action**: Manually copy the entire content from the `<style>` block in `index.html` and paste it into `public/styles.css` below the comment header.
    -   **Code Suggestion**: This is a manual copy/paste operation. The content to be copied starts right after `<style>` and ends right before `</style>` in the current `index.html`.

-   [x] **Topic: Format the Code**
    -   **Action**: Run a code formatter (like Prettier, which is standard for this project) on `public/styles.css` to ensure consistent and clean formatting.
    -   **Code Suggestion**: This is a command-line or editor action, e.g., `prettier --write public/styles.css`.

### Phase 2: Update `index.html` to Link the Stylesheet

-   [x] **Topic: Remove `<style>` block and Add `<link>` tag**
    -   **Action**: In `index.html`, delete the entire `<style>...</style>` block and replace it with a `<link>` tag pointing to the new stylesheet.
    -   **Code Suggestion (Before)**:
        ```html
        <!-- index.html -->
        <head>
            ...
            <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative..." rel="stylesheet">
            <style>
              body {
                font-family: 'Roboto', sans-serif;
              }
              /* ... many more lines of CSS ... */
            </style>
            <script type="importmap">
            ...
            </script>
        </head>
        ```
    -   **Code Suggestion (After)**:
        ```html
        <!-- index.html -->
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Aralia RPG</title>
            <!-- Tailwind CSS is loaded first to provide the base utility classes. -->
            <script src="https://cdn.tailwindcss.com"></script>
            <!-- Font stylesheets are loaded next. -->
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
            
            <!-- 
              The custom stylesheet is linked here, after Tailwind and fonts.
              The href="/styles.css" works because the file is in the /public directory,
              which acts as the web server's root. The browser can now cache this file.
            -->
            <link rel="stylesheet" href="/styles.css">
            
            <!-- The importmap follows the stylesheets. -->
            <script type="importmap">
            {
              /* ... import map content ... */
            }
            </script>
        </head>
        ```

### Phase 3: Verification (Technical)

-   [x] **Topic: Hard Refresh**
    -   **Action**: Perform a hard refresh in your browser to clear the cache. This is typically `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac).
-   [x] **Topic: Visual Inspection**
    -   **Action**: Visually inspect all application components to confirm all custom styles are applied correctly.
-   [x] **Topic: Developer Tools Check**
    -   **Action**:
        1.  Open browser developer tools (F12 or Ctrl+Shift+I).
        2.  Go to the "Network" tab. Reload the page and confirm `styles.css` is listed with a `200 OK` status.
        3.  Go to the "Elements" tab. Inspect the `<head>` and verify the `<link rel="stylesheet" href="/styles.css">` tag is present and the old `<style>` block is gone.

### Phase 4: Update Project Documentation

-   [x] **Topic: Update Documentation Files**
    -   **Action**: Search the project for any mentions of inline CSS and update them to reflect the new external stylesheet.
    -   **Code Suggestion (Example for `docs/PROJECT_OVERVIEW.README.md`)**:
        -   **Before**:
            ```markdown
            *   **Styling**: **Tailwind CSS** for utility-first styling. All custom styles are in `<style>` blocks in `index.html`.
            ```
        -   **After**:
            ```markdown
            *   **Styling**: **Tailwind CSS** for utility-first styling. All custom styles are in a dedicated stylesheet located at `public/styles.css`, which is linked from `index.html`.
            ```

### Phase 5: Final Verification

-   [x] **Topic: Final Review**
    -   **Action**: Re-read the updated documentation files to ensure they are clear, accurate, and consistent with the implemented changes.

---

## 5. Risk Assessment

-   **Overall Risk**: **Low**. This is a standard and highly recommended refactoring practice.
-   **Potential Issues**:
    -   **Flash of Unstyled Content (FOUC)**: Mitigated by correct placement of the `<link>` tag in the `<head>`.
    -   **Caching Issues**: Mitigated by performing a hard refresh during verification.
    -   **Incorrect Path**: Mitigated by placing the file in `/public` and using the root-relative path `/styles.css`.

## 6. Rollback Plan

-   **Simplicity**: The rollback process is trivial.
-   **Steps**:
    1.  Revert the changes to `index.html` to restore the inline `<style>` block.
    2.  Delete the newly created `public/styles.css` file.
    3.  Revert the changes to any documentation files.

## 7. Future Considerations / Follow-up Improvements

-   [ ] **Topic: Refactor to CSS Variables**
    -   **Action**: After the move, a future improvement would be to refactor `styles.css` to use CSS Custom Properties (variables) for common theme colors (e.g., `--color-primary-amber`, `--color-text-light`), fonts, and spacing.
    -   **Code Suggestion**:
        ```css
        :root {
          --color-amber-300: #fcd34d;
          --color-sky-300: #7dd3fc;
          /* ... other variables ... */
        }

        .prose h3 {
          color: var(--color-amber-300);
          border-bottom: 1px solid rgba(252, 211, 77, 0.2);
        }
        
        .glossary-term-link-from-markdown {
          color: var(--color-sky-300);
        }
        ```

-   [ ] **Topic: Organize with Comments**
    -   **Action**: Add structured comments to `styles.css` to delineate logical sections (e.g., `/* --- Prose Styles --- */`, `/* --- Spellbook Styles --- */`) to improve readability.

-   [ ] **Topic: Directory Structure**
    -   **Action**: If the custom CSS grows significantly, consider moving it to `public/css/main.css` and updating the link in `index.html`.