# Aralia RPG - Project Overview

**Last Updated**: 2026-03-10  
**Purpose**: Provide a repo-grounded overview of the current Aralia project without carrying forward outdated architecture assumptions.

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

## Verified Core Systems

The current repo contains verified implementations or active code surfaces for:
- **Character creation** via [`../src/components/CharacterCreator/CharacterCreator.tsx`](../src/components/CharacterCreator/CharacterCreator.tsx)
- **World map exploration** via [`../src/components/MapPane.tsx`](../src/components/MapPane.tsx)
- **Submap exploration** via [`../src/components/Submap/SubmapPane.tsx`](../src/components/Submap/SubmapPane.tsx)
- **Town and village rendering** via [`../src/components/Town/TownCanvas.tsx`](../src/components/Town/TownCanvas.tsx) and [`../src/components/Town/VillageScene.tsx`](../src/components/Town/VillageScene.tsx)
- **Battle map combat** via [`../src/components/BattleMap/BattleMap.tsx`](../src/components/BattleMap/BattleMap.tsx)
- **Character sheet and spellbook UI** via [`../src/components/CharacterSheet/CharacterSheetModal.tsx`](../src/components/CharacterSheet/CharacterSheetModal.tsx) and [`../src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx`](../src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx)
- **Glossary and in-game reference UI** via [`../src/components/Glossary/Glossary.tsx`](../src/components/Glossary/Glossary.tsx)
- **Merchant/economy UI** via [`../src/components/Trade/MerchantModal.tsx`](../src/components/Trade/MerchantModal.tsx)
- **Discovery log UI** via [`../src/components/Logbook/DiscoveryLogPane.tsx`](../src/components/Logbook/DiscoveryLogPane.tsx)
- **Developer/debug UI** via [`../src/components/debug/DevMenu.tsx`](../src/components/debug/DevMenu.tsx)
- **Optional 3D-related UI surface** via [`../src/components/ThreeDModal/ThreeDModal.tsx`](../src/components/ThreeDModal/ThreeDModal.tsx)

## Verified AI And Generation Surfaces

The repo currently includes AI-assisted systems built around Gemini services, with some Ollama-related surfaces also present.

Verified examples include:
- location and wilderness description generation in [`../src/services/geminiService.ts`](../src/services/geminiService.ts)
- NPC response generation in [`../src/services/geminiService.ts`](../src/services/geminiService.ts)
- oracle-style response generation in [`../src/services/geminiService.ts`](../src/services/geminiService.ts)
- guide-response support and related helper flows wired through Gemini service modules
- merchant inventory, harvest, and other generated content helpers in the Gemini service layer
- a game-guide UI surface in [`../src/components/ui/GameGuideModal.tsx`](../src/components/ui/GameGuideModal.tsx)

Because these systems evolve quickly, this document avoids over-specifying exact model behavior beyond what is directly visible in the current code.

## Verified Tech Stack

The current project is built around:
- **React 19** and **React DOM 19**, confirmed in [`../package.json`](../package.json)
- **TypeScript**, confirmed in [`../package.json`](../package.json)
- **Vite** as the build/dev tool, confirmed in [`../package.json`](../package.json)
- **Vitest** for testing, confirmed in [`../package.json`](../package.json)
- **ESLint** for linting, confirmed in [`../package.json`](../package.json)
- **Tailwind CSS** and **PostCSS** in the toolchain, confirmed in [`../package.json`](../package.json)
- **@google/genai** and **@google/generative-ai** dependencies for AI integration, confirmed in [`../package.json`](../package.json)

Important correction:
- this project is **not** a static import-map-only app
- it **does** use a local `package.json`, local dependencies, and a Vite-based workflow

## Verified Entry And Styling Surface

The current frontend entry flow is:
- [`../index.html`](../index.html) -> [`../index.tsx`](../index.tsx) -> [`../src/App.tsx`](../src/App.tsx)

Verified styling facts:
- [`../index.tsx`](../index.tsx) imports [`../src/index.css`](../src/index.css)
- [`../index.html`](../index.html) links a stylesheet via `styles.css`
- the repo also contains styling-related surfaces under [`../src/styles/`](../src/styles/) and [`../public/css/`](../public/css/)

This means older documentation that claimed all custom styles lived in inline `<style>` blocks is no longer accurate.

## Verified Project Structure

Important current top-level source areas under [`../src/`](../src/) include:
- `components`
- `commands`
- `config`
- `constants`
- `context` and `contexts`
- `data`
- `features`
- `hooks`
- `services`
- `state`
- `styles`
- `systems`
- `types`
- `utils`
- `workers`

This is broader than older summaries that only described a smaller React component/hooks/state layout.

## Data And Content Surfaces

Verified data/content surfaces include:
- a large race-data catalog under [`../src/data/races/`](../src/data/races/)
- **19 class definitions** in [`../src/data/classes/index.ts`](../src/data/classes/index.ts)
- glossary content under [`../public/data/glossary/`](../public/data/glossary/)
- glossary entry and index subtrees under:
  - [`../public/data/glossary/entries/`](../public/data/glossary/entries/)
  - [`../public/data/glossary/index/`](../public/data/glossary/index/)
- public data roots under [`../public/data/`](../public/data/) for `dev`, `glossary`, and `spells`

The constants layer in [`../src/constants.ts`](../src/constants.ts) still aggregates and re-exports a large amount of data from specialized modules.

## Save/Load And Development Surfaces

Verified persistence and dev-support facts:
- save/load is implemented through [`../src/services/saveLoadService.ts`](../src/services/saveLoadService.ts)
- that service explicitly uses browser local storage
- developer tools are feature-flagged through [`../src/config/features.ts`](../src/config/features.ts) and [`../src/config/env.ts`](../src/config/env.ts)
- current feature comments explicitly describe developer tools, dummy characters, and debug panels as part of the dev-support surface

To keep this overview accurate, it avoids naming old constants or exact bypass flags unless they are still present under the same name.

## Documentation Orientation

Use these docs as the main starting set:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) for domain-level architecture
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) for practical development orientation
- [`@DOCUMENTATION-GUIDE.md`](./@DOCUMENTATION-GUIDE.md) for documentation-system rules
- [`@README-INDEX.md`](./@README-INDEX.md) for navigation

For source-local implementation detail, use the source-adjacent READMEs under [`../src/`](../src/).

## Notes On Historical Drift

Earlier versions of this file described Aralia as a static, import-map-driven app with no local dependency or Vite build surface.

That is no longer an accurate description of the repository. This file was rewritten against the current repo structure on 2026-03-10 to remove those stale assumptions.
