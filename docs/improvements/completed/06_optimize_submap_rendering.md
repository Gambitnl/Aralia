# Improvement Note: Optimize Submap Rendering

## Status

This is now a preserved completion note.
The central rendering optimization it describes is materially present, but the older file targets paths and implementation details from an earlier repo shape.

## Verified Current State

- The dedicated tile component exists at src/components/Submap/SubmapTile.tsx.
- SubmapPane.tsx imports and renders that component rather than inlining every tile as one large block of JSX.
- SubmapTile.tsx is wrapped in React.memo and includes a custom prop comparison to suppress unnecessary re-renders when tile inputs are stable.
- SubmapPane.tsx now leans on memoized grid data and useCallback handlers before passing tile interaction hooks into SubmapTile.

That means the main performance-oriented refactor did land:

- the tile rendering surface was extracted into its own component
- memoization is part of the live rendering path
- the submap render loop is structured around stable derived data rather than one monolithic tile block

## Historical Drift To Note

The older note assumed the extracted component would live at src/components/SubmapTile.tsx.
The current repo keeps it under src/components/Submap/SubmapTile.tsx instead, alongside the rest of the submap feature surface.

The live component has also grown beyond the simplified sketch in the older note:

- it carries quick-travel and inspection-state visuals
- it renders the player sprite overlay
- it consumes tooltip content separately from the memoized visuals object

So the idea is complete, but the exact structure evolved beyond the original plan.

## What This Means

- this file should be preserved as a completion record, not used as a live optimization plan
- future performance work on the submap should start from the existing Submap/SubmapTile.tsx split instead of proposing that extraction again
- any remaining performance issues should be treated as follow-on profiling work rather than proof that the original split never happened

## Preserved Value

This note still captures a durable UI-performance principle:

- large grid renderers should isolate tile-level rendering where possible
- stable callbacks and memoized derived data matter as much as component extraction
- performance-sensitive map UIs should prefer shared tile primitives over repeating complex inline render logic
