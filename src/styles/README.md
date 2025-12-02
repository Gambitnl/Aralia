# CSS Architecture & Design History

This document outlines the history and reasoning behind the project's CSS architecture.

## Initial State: Inline CSS in `index.html`

Originally, all custom CSS styles for the application were embedded directly within a `<style>` block in the main `index.html` file.

**Problem:** This approach violated the principle of separation of concerns, mixing presentation logic directly with the document structure. It hindered maintainability, readability, and the use of standard development tools for CSS linting and formatting. It also prevented the browser from caching the stylesheet independently, negatively impacting performance.

## Refactor: External Stylesheet in `/public`

To address these issues, the CSS was externalized into a dedicated stylesheet.

**Goal:** The primary goal was to improve code organization, enhance the developer experience, and leverage browser caching to boost performance, aligning the project with standard web development best practices.

**Implementation:**
The stylesheet was created at `public/styles.css`.

**Architectural Constraint:** In this project's unique no-build-tool architecture, the `src/` directory is not directly served or processed. Only files within the `/public` directory are guaranteed to be accessible via root-relative paths from the browser. Therefore, the stylesheet was placed in `/public` so it could be correctly referenced in `index.html` via `<link rel="stylesheet" href="/styles.css">`.

## Future Considerations

The following improvements can be considered for the future:

1.  **Refactor to CSS Variables**: Introduce CSS Custom Properties (variables) for common theme elements like colors, fonts, and spacing to improve consistency and maintainability.
2.  **Organize with Comments**: Add structured comments to `styles.css` to delineate logical sections (e.g., `/* --- Prose Styles --- */`, `/* --- Spellbook Styles --- */`) to improve readability.
3.  **Directory Structure**: If the custom CSS grows significantly, consider moving it into a dedicated subdirectory, such as `public/css/main.css`.
