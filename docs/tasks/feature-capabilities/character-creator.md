# Character Creator

This capability note tracks the current character creation flow as it exists in the repo today. The multi-step flow is implemented, the background step uses an explicit confirmation action, and per-step completion checks exist, but the sidebar still exposes broad navigation instead of acting as a hard sequential gate.

## Current Status

Character creator foundations are implemented and actively used. The flow is not a design-only plan.

## Verified Repo Surfaces

- src/components/CharacterCreator/CharacterCreator.tsx
- src/components/CharacterCreator/BackgroundSelection.tsx
- src/components/CharacterCreator/config/sidebarSteps.ts
- src/components/CharacterCreator/state/characterCreatorState.ts

## Verified Capabilities

### Character Creator Multi-Step Flow

- The character creator is a multi-step flow with grouped origin, class, abilities, and finalization steps.
- The sidebar step configuration and character-creator state drive which steps appear and how selections are summarized.

### Character Creator Background Confirmation

- The background step keeps a local selected background and does not immediately commit it.
- BackgroundSelection.tsx uses an explicit Confirm button before it calls onBackgroundChange and onNext.

### Character Creator Step Completion Controls

- sidebarSteps.ts defines step-completion checks for race, age, background, class, ability scores, class features, weapon mastery, feats, and final name entry.
- These checks support progress summaries and completion state, but they do not prove that every sidebar jump is strictly locked behind completion.

## Remaining Gaps Or Uncertainty

- This doc no longer claims strict sequential locking, because the current sidebar configuration exposes broad navigation even while completion checks exist.
- Rendered UX was not re-verified in this doc pass; this is a code-backed capability note rather than a visual QA report.


