# URL And History State Synchronization

This capability note tracks synchronization between application state and browser history. The baseline hook already exists and handles initial mount behavior, deep-link restoration, state-to-URL syncing, and back-forward restoration through popstate handling.

## Current Status

URL and history synchronization is implemented as a baseline app capability.

## Verified Repo Surfaces

- src/hooks/useHistorySync.ts
- src/state/actionTypes.ts
- src/state/appState.ts

## Verified Capabilities

### URL Initial Mount Guard

- useHistorySync.ts keeps an isInitialMount ref and handles the first sync path separately from later state changes.
- The initial-mount path avoids immediately pushing misleading history entries before the app resolves its first usable state.

### Deep Link Restoration

- The hook parses phase, location, and coordinate parameters from the URL and restores them when the deep link is valid.
- Invalid phase slugs fall back to a not-found path instead of pretending the deep link was valid.

### Browser Navigation Consistency

- Later state changes compare current URL parameters with the desired state and choose pushState or replaceState accordingly.
- A popstate listener restores phase and location context for back-forward navigation.

## Remaining Gaps Or Uncertainty

- This pass verified the hook logic and reducer touchpoints, not every rendered screen transition that depends on that hook.
- The doc now reflects implemented baseline behavior instead of treating history sync as a purely planned capability.
