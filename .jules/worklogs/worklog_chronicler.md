## 2025-05-23 - Context Structure **Learning:** Grouping context into clear sections (Player, Location, Recent Events) with line breaks significantly improves AI adherence to continuity. **Action:** Always format context as structured text blocks rather than a single compressed string.

## 2024-05-22 - Context Injection & Tone Control
**Learning:** Adding a specific "QUEST RELEVANCE" section to the context that keyword-matches objectives to the current location significantly improves AI cohesiveness. It gives the AI specific "hooks" to weave into descriptions without needing to hallucinate details.
**Action:** Always pre-process game state to find relevant logical links (Quest -> Location, NPC -> Faction) and explicitly surface them in a dedicated context section with a "Narrator Note" instruction.

**Learning:** Explicitly instructing the AI to "Show, Don't Tell" and requesting "High Fantasy, Immersive, Gritty" tone prevents the default "helpful assistant" or overly dry RPG outputs.
**Action:** Use these specific style keywords in the "NARRATIVE GUIDELINES" section of all prompt templates.
### 2025-12-22 - Unified Inspection Context
**Learning:** Specific prompts like 'Inspect Tile' often lack the broader atmospheric context (weather, time, location vibe) available to general actions. This leads to dry, disconnected descriptions.
**Action:** Always inject the full `generalActionContext` (or a subset of it) into specific, localized prompts to ground them in the current world state. Use a '## INSPECTION TARGET' header to distinguish the specific focus from the general context.
### 2025-12-22 - Environment Context Injection
**Learning:** General context strings (even with headers) can be overlooked for specific environmental details like weather and time when generating location descriptions. Explicitly passing structured environment data and injecting it into a dedicated `## ENVIRONMENT` prompt section ensures these details are consistently reflected in the narrative.
**Action:** When updating narrative generation functions, prioritize passing structured environment data alongside the general text context to force specific atmospheric inclusion.
