# Aralia Development Guide

**Last Updated**: 2026-03-10  
**Purpose**: Provide practical development orientation for humans and agents without competing with the repo-root instruction files.

## Authority Note

For agent behavior and repo operating rules, use [`../AGENTS.md`](../AGENTS.md).

This file is narrower:
- day-to-day development commands
- directory orientation
- high-level architecture reminders
- manual QA notes that should stay easy to find

## Core Commands

- `npm run dev` starts the Vite dev server
- `npm run build` builds the production bundle
- `npm run preview` previews the production build
- `npm run test` runs Vitest
- `npm run test:types` runs the TSD type tests
- `npm run validate` runs data and charset validation
- `npm run typecheck` runs the TypeScript project build
- `npm run lint` runs ESLint over `src`, `scripts`, and `tests`
- `npm run verify` runs the broader verification chain

When working as an agent in this repo, prefer the workflow wrappers and session rules defined in [`../AGENTS.md`](../AGENTS.md), including `/test-ts`, dependency sync expectations, and `/session-ritual`.

## Architecture Snapshot

- React 19 + TypeScript application built with Vite
- state management is anchored by `src/state/appState.ts` and the reducer/state modules under `src/state`
- UI lives primarily under [`../src/components/`](../src/components/)
- reusable logic lives in [`../src/hooks/`](../src/hooks/)
- game systems and rules logic live across `src/systems`, `src/utils`, `src/data`, and supporting service layers
- project documentation lives in [`./`](./), while source-adjacent implementation docs live near the code in `src`

## Directory Orientation

- [`../src/components/`](../src/components/) contains major UI surfaces and component-local READMEs
- [`../src/data/`](../src/data/) contains static game data and entity definitions
- [`../src/services/`](../src/services/) contains external integration and persistence logic
- [`../src/hooks/`](../src/hooks/) contains reusable game and UI orchestration hooks
- [`../src/state/`](../src/state/) contains reducer-driven state management
- [`./architecture/`](./architecture/) contains domain-level architecture references
- [`./guides/`](./guides/) contains repeatable contributor and workflow docs
- [`./tasks/`](./tasks/) contains active project execution material

## Manual QA Notes

These are intentionally left visible here because they remain open documentation tasks:
- add a cross-browser testing checklist
- add a mobile responsiveness checklist
- add a console-error cleanup checklist for core flows

The backlog items are tracked in [`QOL_TODO.md`](./QOL_TODO.md).

## Documentation Role

This file exists because `docs/AGENT.md` had become a mixed-purpose orientation doc.

The current split is:
- [`AGENT.md`](./AGENT.md): compatibility pointer only
- this file: development orientation
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): architecture map
- [`@DOCUMENTATION-GUIDE.md`](./@DOCUMENTATION-GUIDE.md): doc-system governance
