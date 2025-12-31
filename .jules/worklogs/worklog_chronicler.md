## 2025-05-23 - Context Structure **Learning:** Grouping context into clear sections (Player, Location, Recent Events) with line breaks significantly improves AI adherence to continuity. **Action:** Always format context as structured text blocks rather than a single compressed string.

## 2024-05-22 - Context Injection & Tone Control
**Learning:** Adding a specific "QUEST RELEVANCE" section to the context that keyword-matches objectives to the current location significantly improves AI cohesiveness. It gives the AI specific "hooks" to weave into descriptions without needing to hallucinate details.
**Action:** Always pre-process game state to find relevant logical links (Quest -> Location, NPC -> Faction) and explicitly surface them in a dedicated context section with a "Narrator Note" instruction.

**Learning:** Explicitly instructing the AI to "Show, Don't Tell" and requesting "High Fantasy, Immersive, Gritty" tone prevents the default "helpful assistant" or overly dry RPG outputs.
**Action:** Use these specific style keywords in the "NARRATIVE GUIDELINES" section of all prompt templates.
### 2025-12-22 - Unified Inspection Context
**Learning:** Specific prompts like 'Inspect Tile' often lack the broader atmospheric context (weather, time, location vibe) available to general actions. This leads to dry, disconnected descriptions.
**Action:** Always inject the full `generalActionContext` (or a subset of it) into specific, localized prompts to ground them in the current world state. Use a '## INSPECTION TARGET' header to distinguish the specific focus from the general context.
## 2025-12-23 - World Context in Static Generators
**Learning:** Static generators (like Merchant Inventory) often run in isolation, missing critical world state (Weather, War, Time).
**Action:** Propagate the `generalActionContext` string into these generators. Even if the generator is 'static' (inventory), the world state provides crucial flavor (winter clothes in winter, torches at night).
## 2025-12-29 - Improved Action Outcome Prompt
**Context:** The AI narrative response for player actions was generic and occasionally broke character or missed critical context.
**Options considered:**
- Option A: Just update the System Instruction.
- Option B: Update both System Instruction and Prompt Structure to be explicit about 'QUEST RELEVANCE'.
**Chosen:** Option B.
**Rationale:** The context generator already provides 'QUEST RELEVANCE (CRITICAL)', but the AI wasn't explicitly told to look for it. Adding this instruction directly connects the data pipeline to the narrative output. Also strengthened the anti-hallucination guidelines.
