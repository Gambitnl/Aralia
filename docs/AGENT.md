# AGENT.md — Agent Cold-Start Orientation

Verified: 2026-10-24  
Last Updated: 2026-10-24

Welcome to Aralia. This document is the rapid cold-start orientation for AI coding agents pair-programming on this repository.

---

## 1. Ground Rules & Values

Before touching any code or docs, know the foundational rules:
1. **Canonical Agent Instructions**: Read [`../AGENTS.md`](../AGENTS.md). It defines how agents operate in this repository.
2. **Expansion-First Policy**: Aralia prioritizes preserving intent and embryonic systems over artificial cleanup. Never delete systems or features simply because they appear unfinished.
3. **No Destructive Git Commands**: Never run `git checkout`, `git reset`, or `git commit` unless explicitly instructed by the operator.
4. **Code Commentary Standard**: Plain-English 3-layer comments are required on all code you write or edit (see `.agent/skills/code_commentary/SKILL.md`). The project owner understands agent work primarily through comments.
5. **Where Knowledge Goes**:
   - Living system description: `docs/architecture/domains/<domain>.md`
   - Hard-to-reverse decisions: `docs/adr/NNNN-name.md`
   - Terms & definitions: `CONTEXT.md`
   - Planned work & roadmap: `public/planmap/topics.json`
   - Uncommitted/throwaway proof: `.agent/scratch/` (gitignored)

---

## 2. Multi-Agent Coordination (Agora)

Multiple agents work concurrently in this checkout. Coordination runs via the local Agora daemon (`http://localhost:4319`):
```powershell
# 1. Check who is active
node tools/agora/client.mjs agents

# 2. Check active locks before touching files
node tools/agora/client.mjs locks

# 3. Always acquire an advisory lock BEFORE editing any file
node tools/agora/client.mjs lock <file-path> --reason "your task id / purpose"

# 4. Release locks when finished
node tools/agora/client.mjs unlock --mine
```

---

## 3. Codebase Directory Cheat Sheet

Aralia is built with **React 19**, **TypeScript**, and **Vite** (~4,978 TS/TSX source files):

| Directory | What lives here |
|---|---|
| [`src/components/`](../src/components/) | React UI components (BattleMap, CharacterSheet, DesignPreview, Town, Trade, World3D, layout) |
| [`src/systems/`](../src/systems/) | Core game mechanics and engines (`worldforge`, `world3d`, `spells`, `combat`, `travel`, etc.) |
| [`src/commands/`](../src/commands/) | Decoupled action command pipeline (`factory`, `base`, `effects`) |
| [`src/hooks/`](../src/hooks/) | React custom hooks (game state, history sync, camera, combat) |
| [`src/state/`](../src/state/) | Global state via `useReducer` + Context (no Redux store; no selector layer) |
| [`src/data/`](../src/data/) | Static in-code 5e rules, class definitions, race tables, fixtures |
| [`src/utils/`](../src/utils/) | Pure utility functions (math, geometry, noise, dice, procedural algorithms) |
| [`src/services/`](../src/services/) | External integrations (Gemini AI service, persistence, audio) |
| [`src/devtools/`](../src/devtools/) | Diagnostic harnesses, FPS and performance monitors |
| [`src/types/`](../src/types/) | TypeScript interfaces and type declarations |
| [`public/data/`](../public/data/) | Large runtime JSON datasets (spells, glossary indices) |
| [`public/planmap/`](../public/planmap/) | Planmap topics and health status tracker |
| [`docs/architecture/domains/`](./architecture/domains/) | 44 living domain documents covering each subsystem in detail |

For the complete architectural compendium, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 4. Key Architectural Gotchas

1. **State Access**: State is managed through `useReducer` and accessed via `useGameContext()` / `useGameState()`. There is no selector layer. Components subscribing to state re-render on state changes unless bounded.
2. **Worker Concurrency**: While `src/workers/` holds centralized erosion and mesher workers, ~15 specialized web workers reside co-located with their subsystems in `components/World3D/`, `components/Worldforge/`, `components/BattleMap/`, and `systems/world3d/ocean/`.
3. **Scoped Typechecking**: Running full `npm run typecheck` across all 5,000 files takes 15–30 minutes. Always use scoped typechecking for active task files:
   ```powershell
   npm run typecheck:files -- <path/to/file.ts>
   ```
4. **Visual Proof**: UI fixes must be visually verified in Design Preview at `http://localhost:5173/Aralia/misc/design.html?step=<step>` before marking completed. Never claim a visual fix from code inspection alone.

---

## 5. Further Reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Comprehensive domain and codebase compendium
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) — Local developer setup and commands
- [`@DOCUMENTATION-GUIDE.md`](./@DOCUMENTATION-GUIDE.md) — Documentation maintenance standards
- [`../tools/agora/PROTOCOL.md`](../tools/agora/PROTOCOL.md) — Full Agora daemon coordination protocol
