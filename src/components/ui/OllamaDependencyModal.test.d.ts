/**
 * This file tests the Ollama dependency pane that appears when the local AI
 * service is unavailable.
 *
 * The pane is shown over the main menu and gameplay screens, so these tests
 * protect the parts of the layout that must stay reachable in short browser
 * windows: the scrollable explanation body and the action footer.
 *
 * Called by: Vitest when UI component tests run.
 * Depends on: OllamaDependencyModal for the rendered pane and Testing Library
 * for player-facing queries.
 */
export {};
