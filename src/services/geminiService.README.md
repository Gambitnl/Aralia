# Gemini Service (`src/services/geminiService.ts`)

## Purpose

The `geminiService.ts` module is responsible for all direct interactions with the Google Gemini API for text and image generation. It encapsulates the logic for constructing prompts, calling the API (via the shared `aiClient`), and processing responses.

## Model Configuration

The service now intelligently selects models based on the complexity of the task:
*   **Fast Tasks** (Descriptions, Quick Actions): Uses `gemini-2.5-flash-lite` or similar low-latency models.
*   **Complex Tasks** (Game Guide, Encounter Generation): Uses `gemini-3-pro-preview` or `gemini-2.5-pro`, optionally enabling **Thinking Mode** (`thinkingBudget`) for tasks requiring deep reasoning.

## Core Functionality

The service exports several asynchronous functions, each tailored for a specific type of content generation. All text-generating functions return a `GenerateTextResult` object (`{ text: string, promptSent: string, rawResponse: string }`) for detailed logging.

### Narrative & World Generation

*   `generateLocationDescription(...)`: Generates brief, atmospheric descriptions for named locations.
*   `generateWildernessLocationDescription(...)`: Generates descriptions for procedural wilderness tiles based on biome and coordinates.
*   `generateNPCResponse(...)`: Generates NPC dialogue based on their personality, active goals, and memory context.
*   `generateActionOutcome(...)`: Narrates the result of a player's action.
*   `generateTileInspectionDetails(...)`: Generates immersive descriptions for submap tiles, avoiding game jargon.

### Game Mechanics & Logic

*   **`generateCustomActions(...)`**: Suggests contextual actions (e.g., "Climb the statue", "Listen at the door") and returns them in a structured JSON format.
*   **`generateEncounter(...)`**: Uses Google Search grounding and thinking models to suggest balanced combat encounters based on party strength and location themes. Returns structured JSON.
*   **`generateSituationAnalysis(...)`**: acts as a "DM Hint" system, analyzing the current game state to provide strategic advice.

### Social & Living World

*   **`generateSocialCheckOutcome(...)`**:
    *   **Purpose**: Determines the narrative outcome, disposition change, and goal progression for social skills (Persuasion, Deception).
    *   **Output**: Returns a **structured JSON object** containing `outcomeText`, `dispositionChange`, `memoryFactText` (for NPC memory), and optional `goalUpdate` (if a specific NPC goal was advanced or failed).
*   **`generateOracleResponse(...)`**: Uses the social check logic to allow the Oracle to provide clues that mechanically update NPC goals.
*   **`rephraseFactForGossip(...)`**: Takes a factual statement ("The player killed the dragon") and rephrases it into natural dialogue from the perspective of a specific NPC personality ("I heard that wandering hero slew the beast!"), used for the gossip propagation system.

### Economy & Harvesting

*   **`generateMerchantInventory(...)`**:
    *   **Purpose**: Generates a shop's inventory dynamically based on the village's economy type (e.g., "mining", "farming") and the shop type (e.g., "Blacksmith").
    *   **Output**: Returns a JSON object with a list of `Item` objects and economic factors (`scarcity`, `surplus`) that affect pricing.
*   **`generateHarvestLoot(...)`**:
    *   **Purpose**: Determines what a player finds when foraging or harvesting resources.
    *   **Output**: Returns a JSON array of `Item` objects (food, crafting materials) based on the biome and the player's skill check result.

### AI Game Guide (Chatbot)

*   **`generateGuideResponse(...)`**:
    *   **Purpose**: Powers the in-game help system (`GameGuideModal`).
    *   **Model**: Uses `gemini-3-pro-preview` with a high `thinkingBudget` (32k) to handle complex queries about rules, lore, or character builds.
    *   **Tool Usage**: Can output a specific JSON structure (`tool: "create_character"`) to automatically generate a `PlayerCharacter` object based on user descriptions (e.g., "Make me a level 1 Orc Barbarian").

## Dependencies

*   `./aiClient`: For the shared `ai` client instance.
*   `../config`: For model name constants.
*   `../types`: For various game data types.
*   `../data/item_templates`: For JSON schemas used to constrain item generation.