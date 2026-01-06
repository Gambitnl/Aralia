# Feature Design: The Companion Factory & Emergent Party System

**Status:** Draft
**Owner:** @Gemini
**Dependencies:** `OllamaService`, `CharacterCreator`, `GameContext`

---

## 1. Executive Summary

Currently, Aralia uses static "Dev Characters" (Elara, Kaelen) defined in `dummyCharacter.ts` and `companions.ts`. While useful for testing, they contradict the [Project Vision](../../VISION.md) of an emergent, living world.

The **Companion Factory** is a new service architecture designed to procedurally generate party members on the fly. It combines deterministic game mechanics ("The Skeleton") with LLM-driven creative writing ("The Soul") to create unique characters with history, motivations, and dynamic reactivity.

## 2. Core Philosophy: "Skeleton & Soul"

The generation process is split into two distinct layers to ensure gameplay balance while maximizing narrative depth.

### Layer 1: The Skeleton (Deterministic Mechanics)
*   **Responsibility:** Ensures the character is playable, legal within D&D 5e rules, and balanced.
*   **Engine:** TypeScript Logic (No AI).
*   **Outputs:**
    *   Race & Class (Weighted randomization or specific request).
    *   Ability Scores (Standard Array or Point Buy logic).
    *   Valid Equipment Loadout (based on Class).
    *   HP, AC, Speed, Spell Slots.
*   **Why:** We don't want the AI hallucinating "Laser Rifles" or giving a Wizard 20 Strength and 6 Intelligence.

### Layer 2: The Soul (LLM Narrative)
*   **Responsibility:** Gives the stats a personality, a past, and a reason to exist.
*   **Engine:** `OllamaService` (Model: `leeplenty/ellaria` or `gpt-oss:20b`).
*   **Inputs:** The generated "Skeleton" (e.g., "Level 1 Tiefling Rogue").
*   **Outputs:**
    *   **Identity:** Name, Age, Physical Description (visual prompt).
    *   **Personality:** Values, Fears, Quirks (Big 5 traits).
    *   **Goals:** 1 Overt Goal, 1 Secret/Hidden Goal.
    *   **Backstory:** A brief summary of why they are here.
    *   **Reaction Rules:** Custom triggers for how they react to crime, charity, or combat.

---

## 3. Architecture & Data Flow

```mermaid
graph TD
    A[Dev Menu / Tavern UI] -->|Request: Generate(Lvl 1, Rogue?)| B(CompanionGenerator Service)
    
    subgraph "Phase 1: The Skeleton"
        B --> C[Stat Roller]
        B --> D[Equipment Manager]
        C --> E{Draft Skeleton}
        D --> E
    end
    
    subgraph "Phase 2: The Soul"
        E -->|Context: "Tiefling Rogue"| F[OllamaService]
        F -->|Prompt: "Create personality..."| G(LLM)
        G -->|JSON Output| F
        F --> H{Draft Soul}
    end
    
    subgraph "Phase 3: Integration"
        E --> I[Assembler]
        H --> I
        I --> J[New Game State]
    end
```

## 4. The AI Prompt Strategy

We will use strict JSON schema enforcement to ensure the AI's output plugs directly into our `Companion` types.

**Prompt Draft:**
```text
You are a character writer for a gritty high-fantasy RPG.
Create a complex, believable personality for this character archetype:
[RACE]: Tiefling
[CLASS]: Rogue
[BACKGROUND]: Criminal

Return ONLY valid JSON matching this structure:
{
  "name": "String (Name)",
  "physicalDescription": "String (2 sentences visual description)",
  "personality": {
    "values": ["String", "String", "String"],
    "fears": ["String", "String"],
    "quirks": ["String", "String"]
  },
  "goals": [
    { "description": "String (Public Goal)", "isSecret": false },
    { "description": "String (Secret Goal/Debt/Shame)", "isSecret": true }
  ],
  "reactionStyle": "cynical | hopeful | aggressive | religious"
}
```

## 5. Dynamic Reaction Generation

Instead of hardcoding `ELARA_REACTIONS`, we will generate a "Reaction Profile" during creation.

*   **Static Templates:** We define reaction *categories* (Crime, Charity, Combat).
*   **AI Flavoring:** The factory picks a template (e.g., "Lawful Good Reaction Set") and uses the AI to re-write the dialogue bark lines to match the new character's voice.
    *   *Template:* "Hey, don't steal that!"
    *   *AI Rewrite (Goblin Rogue):* "Whoa, boss! Sneaky! I want half."
    *   *AI Rewrite (Paladin):* "Halt, thief! Return that or face judgment!"

## 6. Implementation Plan

### Phase 1: The Factory Service (Skeleton)
- [ ] Create `src/services/CompanionGenerator.ts`.
- [ ] Implement `generateSkeleton(config)`: Returns a `PlayerCharacter` object with stats but placeholder text.
- [ ] Utilize existing `characterUtils` to ensure math is correct.

### Phase 2: The Soul Generator (AI)
- [ ] Implement `generateSoul(skeleton)`: Calls Ollama.
- [ ] Define Zod schemas for validating AI JSON output.
- [ ] Implement retry logic if JSON is malformed.

### Phase 3: Integration & UI
- [ ] Create `Action: RESTART_WITH_PROCEDURAL_PARTY`.
- [ ] Add loading state (generating 3 characters might take 30-40 seconds).
- [ ] Hook into `DevMenu`.

### Phase 4: Persistence
- [ ] Ensure new IDs (`gen_12345`) are properly saved/loaded in `saveLoadService.ts`.
- [ ] Verify that `companions` state maps correctly to `party` state.

## 7. Future Expansion: "The Tavern"
Eventually, this system moves out of the Dev Menu. When a player enters a Tavern location:
1.  Game calls `CompanionGenerator.generateBatch(3)`.
2.  UI displays 3 characters sitting at tables.
3.  Player can talk to them (Banter) before hiring.
4.  Hiring adds them to the `party` and `companions` state.

---
**Risk Assessment:**
*   **Latency:** Generating 3 characters sequentially could take 30-60s on local hardware. *Mitigation:* Parallel requests or background generation.
*   **Consistency:** AI might generate a "Pacifist Barbarian". *Mitigation:* Inject Class/Race stereotypes into the prompt as "Soft Constraints".
