# Product Definition

## Initial Concept
Aralia RPG is a web-based role-playing game (RPG) featuring 3D exploration (Three.js) and AI-driven features powered by the Google Gemini API.

## Vision
Aralia is an "Everything App" for fantasy role-playing—a living, breathing world simulation where player agency is paramount. The core philosophy is **"Be anyone. Go anywhere. Do anything."** 

The goal is to simulate a tabletop D&D experience where the world reacts logically and meaningfully to every player choice.

## Target Audience
**Hardcore RPG Enthusiasts** who value deep simulation, emergent storytelling, and absolute freedom over linear narratives. Players who want to experiment with a world that remembers their actions.

## Core Pillars
The project currently targets at least 16 major pillars (including Politics, Faith, War, Economy, etc.), but this list is open-ended. The architecture must be flexible enough to accommodate new systems as the simulation evolves.

**Immediate Focus:**
*   **Logical World Simulation:** Prioritizing the "passage of time" and logical cause-and-effect. Events (like wars) must have narrative buildups, execution phases, and lingering consequences.
*   **Dynamic Landscapes:** The world map is not static. While landmarks (towns, towers) have fixed coordinates, the surrounding terrain/biomes can shift based on simulation states (e.g., a drought transforming a prairie into a steppe).

## User Experience (UX)
*   **Immersive First:** The primary interface is a persistent **3D world** (Three.js) to maximize immersion.
*   **Tech Stack:** 
    *   **3D (Three.js):** The primary engine for exploration, world views, and maps. 
    *   *Note: Previous experiments with Pixi.js are being deprecated in favor of a unified 3D approach.*
    *   **Constraint:** Acknowledged challenge in reconciling Three.js with complex environmental spell effects (e.g., terrain destruction).

## AI Strategy (Gemini Integration)
*   **Role:** **High Autonomy (The Dungeon Master).**
*   **Function:** Gemini acts as an active storyteller and logic engine, altering world states based on simulation rules.
*   **Guardrails:** Autonomy is bound by **Narrative Causality**. The AI simulates processes and consequences, avoiding arbitrary or instantaneous world-breaking changes.

## Key Differentiators
1.  **Fluid Identity:** While players make mechanical choices at the start (Race/Class), the world does not label them with static "alignments." Reputation is built solely on actions and how they are witnessed.
2.  **Emergent Narrative:** Stories arise from system interactions (e.g., drought -> famine -> war), not pre-written scripts.
3.  **Living World:** The world progresses independently of the player. Opportunities expire, and the world changes over time.
