# Potential Tool Integrations For Aralia

**Last Updated**: 2026-03-11  
**Purpose**: Preserve exploratory notes about possible tooling directions while clearly separating already-adopted tools from still-hypothetical additions.

## Status Of This File

This is an exploratory reference note.

It is useful for future tooling discussions, but it is not a decision record and it is not a current dependency plan.

## Verified Current Stack Context

Aralia already uses a substantial modern frontend toolchain, including:
- React
- TypeScript
- Vite
- Vitest
- Tailwind
- Zod
- Framer Motion
- Playwright

Because of that, older future-tense statements like "if the project moved to Vite" or "Vitest could be an alternative" are no longer accurate.

## Already Present In The Repo

These tools or categories are already part of the current stack:

### Testing and verification

- `Vitest`
- `Playwright`
- React Testing Library

### Validation and typing support

- `Zod`

### Motion and UI enhancement

- `Framer Motion`

These belong in current stack discussions, not in a purely hypothetical wish list.

## Still Hypothetical Or Optional Candidates

These remain exploratory suggestions rather than adopted standards:

### State management

- Zustand
- Redux Toolkit

### UI primitives

- Headless UI
- Radix UI

### Forms

- React Hook Form

### Utility helpers

- `clsx` or `classnames`
- `date-fns` or `Day.js`

### Motion helpers

- AutoAnimate

### Routing

- React Router, if the app eventually wants more explicit multi-view URL routing

## Current Interpretation

The useful takeaway from this file is not "install these tools."

The useful takeaway is:
- some capabilities are already covered by the current stack
- some remaining tool ideas are optional and should be justified by a concrete gap
- any future adoption decision should be checked against existing repo patterns first

## Maintenance Rule

If a tool listed here becomes adopted:
- move it out of the hypothetical section
- update the wording so the file no longer presents it as future-tense speculation
- if the adoption materially changes development workflow, document that in a canonical workflow or development guide instead of leaving it only here
