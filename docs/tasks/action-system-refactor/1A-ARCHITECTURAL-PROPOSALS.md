# 1A-ARCHITECTURAL-PROPOSALS

This document outlines four key architectural improvements to the Aralia action and state system, derived from the Phase 1 Merchant Overhaul implementation.

## 📝 Proposal 2: Loading State Logic Centralization

**Goal**: Eliminate redundant `dispatch({ type: 'SET_LOADING', ... })` calls in every async handler.

### Proposed Implementation
- Extend `ActionMetadata` to include `showLoading: boolean` and `defaultLoadingMessage?: string`.
- Create a `withLoading` decorator or wrapper in `actionHandlers.ts` that:
  1. Starts the loading state based on metadata.
  2. Executes the handler logic.
  3. Automatically cleans up the loading state once the promise resolves/rejects.

---

## 📝 Proposal 3: Action Validation Layer

**Goal**: Prevent "garbage in, garbage out" by validating action payloads before they trigger side effects.

### Proposed Implementation
- Create a dedicated folder `src/hooks/actions/validators/`.
- Shift logic from `validateMerchantTransaction` into this layer.
- Ensure the `buildActionHandlers` registry can optionally run a pre-execution validator.
- Fail fast: If validation fails, `addMessage` is called and the handler is never executed.

---

## 📝 Proposal 4: JSDoc for Schema Extensions

**Goal**: Maintain clarity as the `GameState` and `Item` interfaces grow beyond standard D&D schemas.

### Proposed Implementation
Establish specific JSDoc tags for the codebase:
- `@persistence`: Identifies fields that must be saved for game recovery (vs transient UI state).
- `@derived`: Identifies fields (like AC or HP) that are recalculated from base stats and equipment.
- `@custom`: Identifies Aralia-specific extensions to the 2024 D&D SRD.

---

## 🌟 Proposal 5: Action Outcome Logging (Creative Idea)

**Goal**: Provide a "Narrative Journal" that records not just what the player did, but the *consequences* of those actions.

### Proposed Implementation
- Add an `outcomes` array to `GameState`.
- Handlers return or dispatch a `ResultPayload` containing:
  - `description`: Narrative text.
  - `impact`: Mechanical summary (e.g., "+20 Notoriety", "-15 Gold").
  - `flavor`: Contextual character reactions.
- Create an "Outcome Feed" UI component that visualizes these results with distinct icons (e.g., a coin icon for gold changes).
