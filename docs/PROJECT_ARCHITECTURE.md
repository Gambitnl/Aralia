# Aralia RPG: Project Overview & Architecture

**Last Updated**: 2026-05-17  
**Purpose**: Provide a repo-grounded overview of the current Aralia project and a high-level map of the codebase organized by product domains.

> **See also**: [VISION.md](./VISION.md) for the product philosophy and design principles underlying this architecture.

## What Aralia Is

Aralia is a React + TypeScript RPG project with a broad gameplay surface that spans:
- character creation
- world and submap exploration
- town and village interaction
- tactical battle map combat
- inventory, economy, and merchant flows
- glossary/reference content
- AI-assisted narrative and helper systems

This overview is intentionally conservative. It describes features and structure that are directly supported by the current repository layout and verified code surfaces.

---

## Verified Core Systems & Domain Map

The current repo contains verified implementations or active code surfaces for the following domains. Each links to deeper documentation (where available) covering current subsystem shape, major files, and related dependencies.

| Domain | Description | Primary Code Surface |
|--------|-------------|----------------------|
| [Glossary](./architecture/domains/glossary.md) | In-game reference system for rules, spells, items | `src/components/Glossary/Glossary.tsx` |
| [World Map](./architecture/domains/world-map.md) | Region-level navigation and exploration | `src/components/MapPane.tsx` |
| [Submap](./architecture/domains/submap.md) | Tile-based exploration within regions | `src/components/Submap/SubmapPane.tsx` |
| [Town Map](./architecture/domains/town-map.md) | Village/town interior navigation | `src/components/Town/TownCanvas.tsx` |
| [Battle Map](./architecture/domains/battle-map.md) | Tactical combat grid and tokens | `src/components/BattleMap/BattleMap.tsx` |
| [Combat](./architecture/domains/combat.md) | Combat mechanics, initiative, actions | `src/utils/combat/combatUtils.ts` |
| [Spells](./architecture/domains/spells.md) | Spell data, targeting, effects | Spell system (`src/components/CharacterSheet/Spellbook/`) |
| [Character Creator](./architecture/domains/character-creator.md) | Character generation wizard | `src/components/CharacterCreator/CharacterCreator.tsx` |
| [Character Sheet](./architecture/domains/character-sheet.md) | Character stats, equipment, abilities | `src/components/CharacterSheet/CharacterSheetModal.tsx` |
| [NPCs / Companions](./architecture/domains/npcs-companions.md) | NPC interactions and party members | Companion systems |
| [Items / Trade / Inventory](./architecture/domains/items-trade-inventory.md) | Item management and economy | `src/components/Trade/MerchantModal.tsx` |
| [Planes / Travel](./architecture/domains/planes-travel.md) | Planar mechanics and travel systems | Planar systems |
| [Data Pipelines](./architecture/domains/data-pipelines.md) | Scripts, generators, validators | `scripts/` |

**Additional Verified UI Surfaces:**
- **Discovery log UI** via `src/components/Logbook/DiscoveryLogPane.tsx`
- **Developer/debug UI** via `src/components/debug/DevMenu.tsx`
- **Optional 3D-related UI surface** via `src/components/ThreeDModal/ThreeDModal.tsx`

---

## Codebase Structure Overview

The current project is built around **React 19**, **TypeScript**, and **Vite**. 
Important top-level source areas under `src/` include:

```text
src/
  components/     # React UI components (organized by feature)
  commands/       # Command-pattern execution and effect orchestration
  config/         # Configuration constants
  constants/      # Aggregated constants
  context/        # React context providers
  data/           # Static game data (races, classes, items)
  features/       # Feature-scoped modules that do not fit a single UI bucket
  hooks/          # React hooks (state, effects, logic)
  services/       # Frontend service-layer modules (AI, persistence, generation, orchestration)
  state/          # Redux-like state management
  styles/         # Shared styling assets and UI identifiers
  systems/        # Game mechanics (combat, spells, planar, etc.)
  types/          # TypeScript type definitions
  utils/          # Utility functions
  workers/        # Worker-side execution surfaces where present

scripts/          # Build-time tools and validators
public/data/      # Runtime JSON data (spells, glossary entries)
docs/             # Documentation (you are here)
```

*(Note: Older documentation that claimed all custom styles lived in inline `<style>` blocks is no longer accurate. The project uses a Vite-based workflow with local dependencies.)*

---

## Data And Content Surfaces

Verified data/content surfaces include:
- a large race-data catalog under `src/data/races/`
- **19 class definitions** in `src/data/classes/index.ts`
- glossary content under `public/data/glossary/`
- glossary entry and index subtrees under `public/data/glossary/entries/` and `public/data/glossary/index/`
- public data roots under `public/data/` for `dev`, `glossary`, and `spells`

The constants layer in `src/constants.ts` still aggregates and re-exports a large amount of data from specialized modules.

---

## Verified AI And Generation Surfaces

The repo currently includes AI-assisted systems built around Gemini services (`@google/genai`), with some Ollama-related surfaces also present. Verified examples include:
- location and wilderness description generation in `src/services/geminiService.ts`
- NPC response generation in `src/services/geminiService.ts`
- oracle-style response generation in `src/services/geminiService.ts`
- guide-response support and related helper flows wired through Gemini service modules
- merchant inventory, harvest, and other generated content helpers in the Gemini service layer
- a game-guide UI surface in `src/components/ui/GameGuideModal.tsx`

Because these systems evolve quickly, this document avoids over-specifying exact model behavior beyond what is directly visible in the current code.

---

## Save/Load And Development Surfaces

Verified persistence and dev-support facts:
- save/load is implemented through `src/services/saveLoadService.ts`
- that service explicitly uses browser local storage
- developer tools are feature-flagged through `src/config/features.ts` and `src/config/env.ts`
- current feature comments explicitly describe developer tools, dummy characters, and debug panels as part of the dev-support surface

---

## Dependency Graph

For detailed file-level dependencies, see the generated artifacts:
- [`_generated/deps.json`](./architecture/_generated/deps.json) - Full import graph
- [`_generated/file-inventory.json`](./architecture/_generated/file-inventory.json) - All tracked files

These are regenerated by running:
```bash
npx --no-install tsx scripts/generate-architecture-compendium.ts
```

## Maintenance

See [architecture/README.md](./architecture/README.md) for:
- How to add new domains
- How to update the domain map and related references
- Domain document template
- Regenerating dependency graphs

---

## Documentation Orientation

Use these docs as the main starting set:
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) for practical development orientation and boot sequence
- [`@DOCUMENTATION-GUIDE.md`](./@DOCUMENTATION-GUIDE.md) for documentation-system rules
- [`@README-INDEX.md`](./@README-INDEX.md) for navigation

For source-local implementation detail, use the source-adjacent READMEs under `src/`.
