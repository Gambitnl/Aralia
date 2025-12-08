# Task: Add a Linting Workflow to Aralia

## Goal
Introduce an automated lint checker to catch obvious code issues (unused variables, missing imports, shadowing, etc.) and enforce a consistent style. Deliver a repeatable `npm run lint` script and document how to run it locally and in CI.

## Scope
- Tooling: ESLint (JavaScript/TypeScript/React), Prettier optional (formatting can be deferred or integrated).
- Codebase: `src/**`, `scripts/**`, and tests. Exclude `dist/`, `node_modules/`, and generated data under `public/`.
- Config: Keep sensible defaults; align with existing TS settings (ESNext, JSX React, strict mode).

## Acceptance Criteria
1) A new `npm run lint` script exists and succeeds on a clean checkout (after `npm install`).
2) ESLint configuration is committed (e.g., `.eslintrc.{js,cjs,json}`) with TS + React support.
3) Ignore files are set for generated/artifact paths (e.g., `.eslintignore`).
4) CI-ready: Document the single command to run lint (`npm run lint`) so it can be wired into pipelines.
5) Does not auto-format or rewrite files by default (prevents surprise diffs); optional formatter can be documented separately.

## Proposed Implementation Steps
1) Add dependencies: `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`. If using Prettier: `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier`.
2) Create `.eslintrc.cjs` with:
   - Parser: `@typescript-eslint/parser`
   - Env: `browser`, `es2022`, `node`
   - Plugins: `@typescript-eslint`, `react`, `react-hooks`, `jsx-a11y`, `import`
   - Extends: `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:react/recommended`, `plugin:react-hooks/recommended`, `plugin:jsx-a11y/recommended`, `plugin:import/recommended`, `plugin:import/typescript`
   - Settings: React version `detect`; Import resolver with TS paths (`@` → `src`)
   - Rules: keep defaults; optionally warn on `any`, unused vars (allow args starting with `_`), and enforce hooks rules.
3) Add `.eslintignore` to skip `dist/`, `node_modules/`, `public/`, `coverage/`, `*.config.*` outputs if needed.
4) Add `lint` script to `package.json`: `"lint": "eslint --ext .ts,.tsx src scripts"`.
5) Run `npm run lint` locally; fix or suppress any initial violations as needed to get a clean pass.
6) Document usage in this file and (optionally) link from `README.md` or dev guide.

## Notes
- Keep formatting separate: if you want auto-formatting later, add Prettier and a `format` script, but keep `lint` as a pure check.
- Path alias: configure ESLint import resolver to respect `@` → `src` (match `tsconfig`/Vite settings).
- If lint noise is high, start with warnings and ratchet over time.

## Usage
- Install dependencies: `npm install`
- Run lint locally or in CI: `npm run lint`
- Config is intentionally set to warn on existing strictness/style issues so adoption doesn’t block other work; tighten rules over time.
