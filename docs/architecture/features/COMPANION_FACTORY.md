# Feature Design: The Companion Factory & Emergent Party System

## Purpose

This file now needs to be read as a current-state feature architecture note rather than a pure future proposal.
The repo already contains a live CompanionGenerator service and related Ollama, NPC-generation, and debug-menu surfaces, but the broader dynamic-party workflow is still only partially traced in this pass.

## Verified Current Surfaces

This pass confirmed the following live implementation anchors:

- src/services/CompanionGenerator.ts
- src/services/characterGenerator.ts
- src/services/npcGenerator.ts
- src/services/ollama/client.ts
- src/services/ollama/jsonParser.ts
- src/data/dev/dummyCharacter.ts
- src/data/companions.ts
- src/components/debug/DevMenu.tsx
- src/services/saveLoadService.ts
- src/types/companion.ts
- src/types/companions.ts

## What Is Already Real

### Skeleton and soul split

The repo now has a real generateSkeleton plus generateSoul split inside CompanionGenerator.ts.
That means the core architecture described in the older design note is no longer just aspirational.

### Mechanical generation

CompanionGenerator.ts already delegates deterministic character generation into the character and NPC generation services.
This confirms that the  Skeleton side of the design is real.

### AI narrative generation

CompanionGenerator.ts also already calls the Ollama client and validates narrative output through the companion soul schema.
This confirms that the Soul side of the design is also real, at least at the service layer.

### Debug-menu trigger surface

DevMenu.tsx now exposes a restart_dynamic_party debug action, which means this feature has at least one verified debug or development-facing trigger surface.

## Important Corrections

- The older file's create src/services/CompanionGenerator.ts step is no longer future work; that file already exists.
- The Ollama layer is no longer a single flat OllamaService file in the way the original note implied. The live repo now uses the src/services/ollama/ subtree and related helper files.
- This pass did not fully verify the end-to-end action wiring or save-load persistence for generated companions, so those parts should remain marked as partial or still needing verification.
- The feature should therefore be described as partially implemented architecture with unfinished integration, not as either a blank proposal or a finished delivered system.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as the Companion Factory architecture note for a partially implemented feature: the generator service, Ollama-backed soul generation, and debug trigger surfaces are real, while broader dynamic-party flow, persistence, and production-facing recruitment UX still need further verification or follow-through.
