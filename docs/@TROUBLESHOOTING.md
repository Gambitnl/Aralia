# Troubleshooting Guide

**Last Updated**: 2026-03-11  
**Purpose**: Capture recurring technical failure modes in Aralia while clearly separating current troubleshooting guidance from preserved architectural history.

## How To Read This File

This file mixes two kinds of information on purpose:
- current troubleshooting guidance that still matches the repo
- historical fix notes that explain why certain code patterns exist

When a section describes a past fix rather than an active debugging workflow, it is labeled as historical context instead of a live operational rule.

## State Management

### Circular dependency history

**Historical issue**: `appState.ts` once defined `AppAction` while reducers also needed that type, creating an import cycle.

**Current state**: `AppAction` now lives in `src/state/actionTypes.ts`, and state modules import it from there.

**Why it matters**: If a new state refactor starts pulling action types back into `appState.ts`, that old cycle risk can reappear.

### Nested state immutability

**Problem pattern**: React components may not re-render if reducers mutate nested data in place.

**Current guidance**: Create fresh references at every changed nesting level, especially for structures like `npcMemory`.

```typescript
return {
  ...state,
  nested: {
    ...state.nested,
    field: newValue,
  },
};
```

## Gemini Integration

### JSON parsing cleanup

**Historical issue**: AI responses sometimes arrive wrapped in fenced Markdown code blocks, which can break direct JSON parsing.

**Current note**: JSON-cleaning logic exists in the Gemini-related UI and service flow, but do not assume `src/services/geminiService.ts` is the single place where that cleanup happens today.

**Practical rule**: If parsing fails, inspect the actual response-handling path that owns the feature you are debugging instead of assuming one legacy service file still does all cleanup.

### Rate limiting and model fallback

**Problem pattern**: Repeated Gemini calls can hit rate limits or model failures.

**Current guidance**: Check the Gemini core flow and model configuration rather than only the older facade file.

Relevant current surfaces:
- `src/services/gemini/core.ts`
- `src/config/geminiConfig.ts`
- `src/services/geminiService.ts`

## Rendering And Assets

### Mannequin slot icons

**Problem pattern**: Equipment-slot imagery may be missing or unavailable.

**Current state**: `DynamicMannequinSlotIcon.tsx` still supports fallback behavior, and the current implementation defaults to fallback icons because dynamic mannequin SVG loading is disabled.

**Troubleshooting direction**:
- verify whether the missing image is expected under the current fallback-first setup
- only debug SVG loading paths if that feature is being intentionally re-enabled

### Submap rendering performance

**Problem pattern**: Large tile counts can cause sluggish rendering.

**Current guidance**:
1. `SubmapTile` memoization still matters.
2. Handler stability still matters; callbacks passed into tiles should remain memoized so `React.memo` is not defeated.

If submap performance regresses, inspect both the tile component and its parent callback creation path before assuming the problem is purely visual.

## Content Rendering

### Markdown tables inside collapsible sections

**Problem pattern**: Markdown tables do not render reliably when authored directly inside HTML `<details>` blocks.

**Current guidance**: `GlossaryContentRenderer` handles this by parsing markdown first and then constructing `<details>` wrappers programmatically.

**Why it matters**: If glossary rendering breaks, the safe fix is usually to preserve that post-parse wrapping approach rather than reintroducing raw HTML-wrapped markdown tables.

## Architectural Context Worth Preserving

### Prop drilling versus global context

**Historical context**: Some surfaces favored explicit prop passing for local state flow, while `GlossaryContext` was used for genuinely global glossary data.

**Current caution**: Treat this as historical architectural reasoning, not as a blanket ban on Context. Verify the local subsystem before copying the older rationale into new work.

## Troubleshooting Habits

When using this file:
1. verify the relevant code path still exists where the note says it does
2. distinguish between a historical fix note and a current operational rule
3. update this file when the real implementation location changes enough to make a note misleading

For broader verification expectations, see [`@VERIFICATION-OF-CHANGES-GUIDE.md`](./@VERIFICATION-OF-CHANGES-GUIDE.md).
