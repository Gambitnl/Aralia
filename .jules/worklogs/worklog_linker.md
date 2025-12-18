## 2024-05-22 - AI Text Coherence Gap
**Learning:** `geminiService` generates narrative text (e.g., `generateActionOutcome`) that may invent entities (places, people) without validating against the `GameState`. A specific TODO was found requesting an `EntityResolverService`.
**Action:** Created `EntityResolverService` to parse text for entities and validate them against known Factions and Locations, providing a framework for future "Stub" creation.
