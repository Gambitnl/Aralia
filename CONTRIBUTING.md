# Contributing to Aralia RPG

Welcome to the team! We're excited to have you help us build this text-based RPG.

This guide will help you get started with contributing to the project.

## 🗺️ The Map (Project Structure)

Before you venture forth, take a moment to understand the terrain:

*   **`src/components/`**: The UI components.
*   **`src/services/`**: External interactions (Gemini API, Storage).
*   **`src/hooks/`**: Game logic and state management.
*   **`src/data/`**: Static game data (races, classes, items).
*   **`docs/`**: Detailed documentation. Start with [`docs/@README-INDEX.md`](./docs/@README-INDEX.md).

## 🛠️ Setting Up Your Camp

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```
    *Tip: We use `pnpm` exclusively to manage dependencies.*

2.  **Environment Setup**:
    *   Copy `.env.example` to `.env`.
    *   Add your `GEMINI_API_KEY`.
    *   (Optional) Set `VITE_ENABLE_DEV_TOOLS=true` to enable the debug menu.

3.  **Start the Server**:
    ```bash
    pnpm run dev
    ```

## 🧪 Testing Your Gear

We prefer to catch bugs before they reach the dungeon.

*   **Run Unit Tests**:
    ```bash
    pnpm test
    ```
    *This runs Vitest on all `.test.tsx` and `.test.ts` files.*

*   **Type Checking**:
    ```bash
    pnpm run typecheck
    ```
    *Ensures TypeScript is happy.*

*   **Linting**:
    ```bash
    pnpm run lint
    ```
    *Checks for code style and potential errors.*

## 📝 Making Changes

1.  **Create a Branch**: Use a descriptive name (e.g., `feat/add-inventory-sort`, `fix/broken-link`).
2.  **Small Commits**: Keep your changes focused.
3.  **Update Docs**: If you change a feature, please update the relevant `README.md` (often found next to the component).

## 💡 Guide's Tips for UI

*   **Empty States**: If you create a list, always handle the case where it's empty. Don't leave the user staring at a blank box.
*   **Tooltips**: Use the `<Tooltip>` component for complex RPG terms or icons.
*   **Feedback**: Ensure buttons show a loading state or visual feedback when clicked.

Thank you for helping us build Aralia!
