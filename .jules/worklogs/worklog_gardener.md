# Gardener's Journal

## 2024-05-22 - Initial Setup
**Learning:** Initialized the Gardener's worklog.
**Action:** Always check for this file before starting work.

## 2024-05-22 - Critical Infrastructure Debt: Broken Linting
**Learning:** `npm run lint` is currently broken. The project has ESLint v9 installed but uses a legacy `.eslintrc.cjs` configuration. ESLint v9 defaults to "Flat Config" (`eslint.config.js`) and drops support for the old format unless strictly configured, but even `ESLINT_USE_FLAT_CONFIG=false` failed due to missing plugin dependencies (`@typescript-eslint/eslint-plugin`).
**Impact:** We cannot automatically detect unused variables, unused imports, or other "code rot" indicators. This leaves the Gardener blind to the most common maintenance tasks.
**Action (TODO):**
1.  **Migrate to Flat Config:** Create `eslint.config.js` and move rules from `.eslintrc.cjs` into it.
2.  **Fix Dependencies:** Ensure all ESLint plugins (react, typescript-eslint, imports) are compatible with v9 and Flat Config.
3.  **Enable Dead Code Rules:** explicit rules for `no-unused-vars` and `unused-imports` to automate gardening.
4.  **Verify:** Run `npm run lint` to ensure it passes or correctly flags issues.
