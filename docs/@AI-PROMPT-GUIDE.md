
# Guide: Crafting Effective Prompts for Your AI Frontend Engineer

This guide helps you structure your requests to get the best results when asking an AI assistant (like me, your Senior Frontend Engineer) to make changes to the Aralia RPG application. Think of this as a collaboration guide for working with *any* AI assistant on this project.

## 1. The Goal: From Instruction to Collaboration

My primary function is to serve your vision for this application. The most effective requests go beyond simple instructions ("change this button to blue") and express a goal ("I want this button to feel more magical and important").

*   **State Your Goal**: Explain *why* you want a change. Understanding the user goal helps me make better design and technical choices.
*   **Request Options**: If you're unsure of the best implementation, ask for alternatives! For example: "I need a way to display character skills. Could you suggest a few different UI layouts?"
*   **Specify Constraints (or Don't!)**: Tell me if you want to stick to existing patterns or if you're open to new ideas. A prompt like, "Feel free to introduce a new component or library if it's the best solution," gives me creative freedom.

## 2. Understanding the Aralia RPG Architecture

To know what's possible, it helps to understand the application's technical landscape.

### What the App Uses (The Core Stack)

*   **Framework**: **React** (v19) using modern features like hooks.
*   **Language**: **TypeScript** for type safety.
*   **Styling**: **Tailwind CSS** for utility-first styling. All custom styles are in `<style>` blocks in `index.html`.
*   **Modules**: The app uses native **ES6 Modules**. The `index.html` file contains an `<script type="importmap">` which defines how modules like `react`, `@google/genai`, etc., are loaded directly from `esm.sh`. **There is no local `node_modules` folder or complex build tool like Webpack or Vite.**
*   **AI Integration**: The app uses the **`@google/genai`** SDK for all interactions with the Gemini models. This is a core, unchangeable requirement.

### Architectural Constraints (What I Can't Do)

Because this is a client-side, static application without a traditional build pipeline, there are some hard limitations:
*   **No Backend**: I cannot add a server, a database (like MySQL, MongoDB), or server-side languages (like Node.js, Python, PHP). All state must be managed on the client or saved to Local Storage.
*   **No Build Tools**: I cannot introduce complex build systems (Webpack, Vite, Babel) or modify a `package.json` file. All dependencies must be available via the existing import-map structure from a CDN like `esm.sh`.
*   **No New Top-Level Files**: I cannot add new files to the absolute root directory. New files should be placed in appropriate subdirectories (e.g., `src/components/`, `src/hooks/`).

### Architectural Possibilities (Thinking Outside the Box)

While we can't use a build system, we **can** introduce new client-side libraries via the import-map. You can guide me to build more advanced features by suggesting specific, well-known libraries that are available on a CDN like `esm.sh`. This provides the necessary inspiration without requiring access to local project files.

**You could ask me to:**
*   "Integrate **Zustand** to manage our game state more effectively instead of passing props everywhere."
*   "Use **Headless UI** to build a new, fully accessible modal component."
*   "Refactor the Oracle query form to use **React Hook Form** for better state management and validation."
*   "Animate the appearance of the new quest log using **Framer Motion**."

## 3. The Mechanics of a Request

### The Golden Rule: Every Prompt is a Fresh Start

It's crucial to understand that the AI assistant is **stateless**. I have no memory of our previous conversations, the reasoning behind past decisions, or the files we've just edited. **For every new request, you must assume you are briefing a new developer who has never seen the project before.**

This is why providing full context is not just helpful, but **mandatory**.

### Providing Context
When asking for code modifications or new features, you **must** provide the current content of all relevant files.
*   **File List**: Use the `--- START OF FILE [full_path] ---` and `--- END OF FILE [full_path] ---` markers for each file.
*   **Complete Content**: Include the *entire content* of each file. I do not have memory of previous states beyond the current prompt's context.

### My Output
When you ask me to make a change, I will provide the complete, updated files in a structured format that the system uses to apply the changes. You don't need to worry about the specific XML syntax-just know that when I provide code, I'm providing the **entire file**, ready to replace the old one.

## 4. Versioning System

To help track our progress, the application now uses a structured versioning system.

*   **Central History File**: All version information is stored in **`docs/version_history.json`**.
*   **How it Works**: This file is an object where each key is a `feature` name (e.g., "Glossary System", "Spell Data Model"). The value for each key is an array of version entries for that feature, sorted with the newest first. Each entry includes:
    *   An overall app `version`.
    *   A `feature_version`.
    *   A `description` of the change.
*   **Your Role**: When you want to continue working on something, you can now be more specific. For example:
    > "Let's continue working on the Glossary UI. The last version was v0.1.1. I'd like to add a new section for magic items."

    This allows me to easily find the last feature version and increment it correctly in the `version_history.json` file, ensuring our changelog is accurate and organized. I will handle updating the version numbers in both the history file and the `misc/metadata.json` file.
