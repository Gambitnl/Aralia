## 2024-05-22 - AI Text Coherence Gap
**Learning:** geminiService generates narrative text (e.g., generateActionOutcome) that may invent entities (places, people) without validating against the GameState. A specific TODO was found requesting an EntityResolverService.
**Action:** Created EntityResolverService to parse text for entities and validate them against known Factions and Locations, providing a framework for future Stub creation.

## 2024-05-22 - Location Description Coherence
**Learning:** `handleMovement.ts` generates location descriptions via AI but was not using the `EntityResolverService` pipeline. This meant players could arrive at a "named" location invented by the AI that had no underlying entity data.
**Action:** Integrated `resolveAndRegisterEntities` into the movement flow in `src/hooks/actions/handleMovement.ts` to ensure immediate reification of any mentioned entities upon arrival.
