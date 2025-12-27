# Aralia Codebase Guidelines

Technical standards for all personas. Start here, dive into guides as needed.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (includes tsc) |
| `npm test` | Run tests (Vitest) |
| `npm run lint` | ESLint |

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| Bundler | Vite |
| Package Manager | npm (**DO NOT use pnpm**) |
| Styling | Tailwind CSS |
| AI | AI service (`@google/genai`) |
| State | React hooks + context |

---

## Directory Structure

```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── services/       # External integrations (AI, storage)
├── state/          # Reducers, initial state
├── types/          # TypeScript interfaces
├── utils/          # Pure utility functions
├── data/           # Static game data
└── constants.ts    # Global constants

public/data/        # Spells, glossary (JSON/MD)
docs/               # Human documentation
.jules/             # Agent system
```

---

## Guides

### Code Quality

| Topic | Guide | Summary |
|-------|-------|---------|
| TypeScript | [typescript.md](guides/typescript.md) | Type safety, generics, discriminated unions, type guards |
| React Patterns | [react-patterns.md](guides/react-patterns.md) | Component structure, hooks, state management |
| Naming | [naming.md](guides/naming.md) | File, function, and variable naming conventions |

### Domain Knowledge

| Topic | Guide | Summary |
|-------|-------|---------|
| D&D Rules | [dnd-domain.md](guides/dnd-domain.md) | Terminology, spell data, game calculations |
| Architecture | [architecture.md](guides/architecture.md) | Key files, constraints, what you can/can't do |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component |
| `src/state/appReducer.ts` | Main state reducer |
| `src/types.ts` | Core type definitions |
| `src/services/geminiService.ts` | AI integration |
| `src/utils/spellValidator.ts` | Spell validation |

---

*See [_METHODOLOGY.md](_METHODOLOGY.md) for process guidelines.*
*See [_ROSTER.md](_ROSTER.md) for persona domains.*
