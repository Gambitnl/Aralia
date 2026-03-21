# Improvement Note: Externalize CSS

## Status

This is now a preserved completion note.
The core move away from inline custom CSS is complete, but the older note contains architecture assumptions that no longer match the repo.

## Verified Current State

- `public/styles.css` exists.
- `index.html` links that external stylesheet.
- The stylesheet has evolved beyond a single flat dump and now imports modular CSS from `public/css/`.

That means the main improvement did land:

- custom CSS is no longer living only inside an inline `<style>` block in `index.html`
- the repo now has an external stylesheet surface that can grow more cleanly

## Historical Drift To Note

The older note described the repo as a special no-build-tool architecture where `/public` was the only safe place for styles to be served.
That is no longer the right framing for the current repo.

The repo now uses a modern Vite-based setup, and the current external stylesheet arrangement should be understood in that context rather than through the older static-app explanation.

## What This Means

- the CSS externalization work is complete
- this file should be preserved as a completion record, not an active refactor plan
- the remaining value is historical context for why the app moved away from inline custom CSS and toward a maintainable external style lane

## Preserved Value

This note still captures a durable frontend principle:

- custom CSS should live in dedicated files
- layout and styling concerns should not be trapped inside `index.html`
- stylesheet organization can continue improving from the already-externalized baseline instead of revisiting the original extraction step
