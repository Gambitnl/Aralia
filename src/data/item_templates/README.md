
# Item Templates (`src/data/item_templates/`)

## Purpose

This directory contains the foundational "scaffolding" for the **Generative Asset Pipeline**. The files within define the schemas that the game engine provides to the Gemini API when requesting the creation of new game items.

These are not TypeScript interfaces, but rather **schema-defining JavaScript objects**. They act as a contract or a template, ensuring that the AI's creative output (a JSON object representing an item) adheres to a predictable and structurally valid format that the game's code can reliably parse and use.

## The "Shape-Sorter" Analogy

As discussed, this system works like a child's shape-sorter toy:
*   **The Templates (The "Holes")**: We, the engineers, define the rigid structure of what an item can be (e.g., a `WeaponTemplate`, an `ArmorTemplate`).
*   **The AI's Output (The "Shapes")**: The Gemini API is tasked with generating a creative item that perfectly fits into one of these predefined "holes" (schemas).

This approach gives us the best of both worlds: the creative variety of an AI and the structural integrity of a hand-coded system.

## Core Functionality

1.  **Schema Definition**: Each file (or export within `index.ts`) defines a template for a type of item. For example, `WeaponTemplate` inherits from `BaseItemTemplate` and adds weapon-specific fields like `damageDice` and `properties`.
2.  **AI Prompting**: A service (e.g., `geminiService`) uses these templates to build prompts for the Gemini API.
    *   Selecting the appropriate template based on the desired item type.
    *   Constructing a prompt for the Gemini API that includes the context (e.g., "The player just defeated a goblin shaman") and the JSON schema from the template file.
    *   Instructing the AI to return **only** a valid JSON object that conforms to the provided schema.
3.  **Validation**: The game engine can then parse the returned JSON and validate it against the original template schema before adding the new item to the game state.

## Usage

*   **`geminiService.ts`**: Uses these templates to constrain AI generation.
*   **`src/types.ts`**: The `Item` type in `types.ts` is designed to be compatible with the data structure that these templates will produce. Any changes to the templates should be reflected in the `Item` type definition.

This system is the cornerstone of our hybrid approach to content creation, enabling a scalable and maintainable method for populating the world of Aralia with unique items.
