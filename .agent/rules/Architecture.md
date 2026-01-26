# Architecture & AI Reliability

This file defines the "harnesses" and safety rules for AI-driven development in the Aralia codebase. These rules are designed to prevent "The Trap" (breaking dependencies) and ensure high-fidelity communication between files.

## Handling Exports & Breaching Change
Before renaming, deleting, or significantly changing the signature of an **exported** code item (function, component, class, etc.), the AI MUST:

1.  **Check Dependents**: Use the `grep_search` tool or the **Codebase Visualizer** to identify every file that imports the item.
2.  **Verify Impact**: Evaluate if the change will cause syntax errors or logic breaks in those dependent files.
3.  **Proactive Update**: Include updates to all dependent files in the same task/PR to ensure the codebase remains in a buildable state.

## Dependency Documentation
When requested by the user, the AI can maintain a "Dependency Block" at the top of a file. This block serves as a "Local Map" to catch the AI's attention during file viewing.

**Format:**
```typescript
/**
 * [File Description]
 * 
 * DEPENDENCIES:
 * - Exports used by: [FileA], [FileB]
 * - Imports from: [FileX], [FileY]
 */
```

> [!IMPORTANT]
> Do not rely solely on these comments as they can become stale. Always verify with `grep` or the Visualizer for the "ground truth."

## Solo Architect Modus Operandi
- **Verification over Assumption**: Even if a file *seems* isolated, always run a quick `grep` for its path before making structural changes.
- **Surgical Sync**: After modifying core logic (utils, hooks, stats), re-run `npx tsx scripts/codebase-visualizer-server.ts --sync path/to/file.ts`. This ensures the "Stop Sign" header is accurate for future tasks.
- **Preservationist Mentality**: When resolving type errors or technical debt, prioritize minimal, behavior-preserving changes.
  - **Minimal Impact**: Add types or guards rather than restructuring.
  - **No Deletion**: NEVER remove features or exports simply to satisfy the linter/compiler.
  - **Explicit Intent**: If a loose type or assertion is necessary, mark it with `// TODO(next-agent): Preserve behavior; refine type for [symbol] (was any/undefined).`

## Nominal Clarity & Naming
To prevent collisions and AI confusion:
1.  **Unique Exports**: Avoid generic names like `Data`, `Config`, or `Wrapper` for exports. Use context-rich names (e.g., `EconomyConfig`, `CharacterStyleWrapper`).
2.  **Explicit Naming**: Favor descriptive names over brevity. `getValidTradeRoutes` is better than `getRoutes`.
3.  **No Duplicate Basenames**: Avoid having multiple files with the same name (e.g., three different `index.ts` or `styles.css`) in the same sub-system.
