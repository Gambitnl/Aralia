# GlossaryContext

## Purpose

`GlossaryContext.tsx` loads the game's glossary once and shares it with any
component through React Context. It fetches a single pre-built bundle,
deduplicates the entries, and exposes the result. This avoids prop-drilling and
means the data loads only once.

Source: `src/context/GlossaryContext.tsx`, context object `GlossaryContext`
(`createContext<GlossaryEntry[] | null>(null)`, line 24) and provider component
`GlossaryProvider` (lines 32-84).

Confirmed consumers (`useContext(GlossaryContext)` or `GlossaryProvider`),
verified by grep against the file's own dependency header
(`GlossaryContext.tsx` lines 1-15, "Dependents: ..."):

*   `src/components/Glossary/Glossary.tsx` (`useContext(GlossaryContext)`, line 105)
*   `src/components/Glossary/GlossaryContentRenderer.tsx` (line 201)
*   `src/components/Glossary/GlossaryTooltip.tsx` (line 47)
*   `src/components/Glossary/SingleGlossaryEntryModal.tsx` (line 46)
*   `src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx` (line 36)
*   `src/components/WorldPane.tsx` (line 36)
*   `src/components/providers/DataLoaderGate.tsx` (line 18)
*   `src/components/providers/AppProviders.tsx` — mounts `GlossaryProvider`
    (line 35: `<GlossaryProvider enabled={loadGlossaryData}>`)
*   `src/components/DesignPreview/steps/GlossaryRedirectSurfacesPanel.tsx` (line 150)
*   `src/components/DesignPreview/steps/PreviewGlossaryRedirectSurfaces.tsx` —
    wraps preview samples in `GlossaryProvider` (line 25) so redirect ids
    resolve against the real bundle
*   `src/components/DesignPreview/steps/PreviewSpellGlossary.tsx` — both reads
    the context (line 37) and re-provides a filtered subset via
    `GlossaryContext.Provider` directly (lines 56-64) for a spell-only view

## Core functionality

`GlossaryProvider` (`GlossaryContext.tsx`, lines 32-84) runs one fetch inside a
`useEffect` (lines 36-73):

1.  **Fetch the bundle.** It requests `data/glossary_bundle.json` (resolved
    through `assetUrl`, imported from `../config/env`) using `fetchWithTimeout`
    (imported from `../utils/context`) with a 15-second timeout
    (`{ timeoutMs: 15000 }`, lines 42-45). This single file already holds every
    glossary entry, so the provider does not fetch or walk any index files.

2.  **Validate the response.** If the payload is missing or is not an array,
    the provider throws `"Glossary bundle is invalid or missing"` (line 50).

3.  **Deduplicate.** It builds a `Map` keyed by entry `id` and keeps the last
    entry for each id via `[...new Map(allEntries.map(item => [item.id, item])).values()]`
    (line 54), so duplicate ids cannot appear in the final list.

4.  **Publish.** It calls `setEntries(finalUniqueEntries)` and `setError(null)`
    (lines 56-57).

The provider fetches only once: the effect guard `if (!enabled || entries !== null) return;`
(line 37) skips re-fetching once `entries` is non-null, and a `didCancel` flag
(set in the cleanup function, lines 70-72) ignores a late response after the
provider unmounts.

## The `enabled` prop

```tsx
interface GlossaryProviderProps {
  children: ReactNode;
  enabled?: boolean; // defaults to true
}
```

Source: `GlossaryContext.tsx`, `GlossaryProviderProps` (lines 26-30) and the
default binding `enabled = true` in the `GlossaryProvider` destructured props
(line 32).

`enabled` defers the fetch until the glossary or game shell actually needs it
(see the inline doc comment on the prop, line 28). While `enabled` is `false`,
the effect guard on line 37 returns before fetching, so the provider still
renders its children but does not load the bundle. Set it to `true` (or omit
it) to trigger the load.

Live example: `src/components/providers/AppProviders.tsx` line 35 passes
`enabled={loadGlossaryData}`, gating the fetch behind a caller-supplied flag
rather than loading unconditionally on mount.

## State and provided value

*   **`entries: GlossaryEntry[] | null`** — the shared glossary data
    (`useState<GlossaryEntry[] | null>(null)`, `GlossaryContext.tsx` line 33).
    It is `null` before loading finishes, the full deduplicated array on
    success (`setEntries(finalUniqueEntries)`, line 56), and an empty array
    (`[]`) if the fetch fails (`setEntries([])`, line 64).
*   **`error: string | null`** — the error message from a failed fetch
    (`setError(errorMessage)`, line 63), or `null` (`useState<string | null>(null)`,
    line 34; cleared to `null` on success, line 57).

The context value passed to `GlossaryContext.Provider` is `entries`
(`GlossaryContext.tsx` line 80: `<GlossaryContext.Provider value={entries}>`),
typed `GlossaryEntry[] | null`. The provider does **not** hold back its
children while loading and does **not** render a loading spinner — there is no
loading-specific branch in the component body (lines 75-83). Consumers
therefore receive `null` during loading and must handle that case themselves,
as seen in `Glossary.tsx` line 105, `GlossaryTooltip.tsx` line 47, and
`SingleGlossaryEntryModal.tsx` line 46, which all type their local binding as
possibly-null.

## Usage

Wrap the part of the tree that needs glossary access with `GlossaryProvider`.
Real usage: `src/components/providers/AppProviders.tsx` line 35.

```tsx
import { GlossaryProvider } from './context/GlossaryContext';

const App: React.FC = () => (
  <GlossaryProvider>
    {/* ... rest of the application ... */}
    <Glossary isOpen={isGlossaryOpen} ... />
  </GlossaryProvider>
);
```

Any descendant reads the data with `useContext`. Remember that the value can be
`null` while the bundle loads. Real usage: `src/components/WorldPane.tsx` line 36
(`const glossaryEntries = useContext(GlossaryContext);`).

```tsx
import { useContext } from 'react';
import GlossaryContext from '../context/GlossaryContext';

const entries = useContext(GlossaryContext); // GlossaryEntry[] | null
```

## Extension points

*   **Scoped/filtered views.** A consumer can re-provide a narrower slice of
    the same context type without touching `GlossaryContext.tsx`. Real
    example: `src/components/DesignPreview/steps/PreviewSpellGlossary.tsx`
    lines 56-64 read the real entries via `useContext(GlossaryContext)`
    (line 37), filter them to spell-only entries, and wrap its own subtree in
    `<GlossaryContext.Provider value={spellOnlyEntries}>` — any descendant
    inside that inner provider sees the filtered list instead of the full
    bundle.
*   **Deferred loading.** Any new mount point can pass `enabled={false}` (or a
    computed flag, as `AppProviders.tsx` line 35 does) to delay the fetch
    until a gating condition is met, without any change to
    `GlossaryProvider` itself.
*   **Bundle shape.** The provider only requires the fetched payload to be an
    array of `GlossaryEntry` (type imported from `../types`) with an `id`
    field, since deduplication keys on `item.id` (`GlossaryContext.tsx`
    line 54). Extending `GlossaryEntry` with new fields does not require
    changes to `GlossaryContext.tsx`; only the bundle build step and the
    consuming components need to change.

## Error handling

If the fetch fails, the provider logs the error to the console
(`console.error("Failed to load complete glossary bundle:", errorMessage)`,
`GlossaryContext.tsx` line 62), stores the message in `error` state (line 63),
and sets `entries` to an empty array (line 64). The component body then checks
`if (error)` (line 75) and renders `ErrorOverlay` (imported from
`../components/ui/ErrorOverlay`) in place of its children (line 76), so the
message covers the screen and the app does not continue with missing data.
