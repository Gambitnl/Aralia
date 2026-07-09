# GlossaryContext

## Purpose

`GlossaryContext.tsx` loads the game's glossary once and shares it with any
component through React Context. It fetches a single pre-built bundle,
deduplicates the entries, and exposes the result. This avoids prop-drilling and
means the data loads only once.

Consumers include `Glossary.tsx`, `GlossaryTooltip.tsx`,
`SingleGlossaryEntryModal.tsx`, and the spellbook and design-preview surfaces.

## Core functionality

`GlossaryProvider` runs one fetch inside a `useEffect`:

1.  **Fetch the bundle.** It requests `data/glossary_bundle.json` (resolved
    through `assetUrl`) using `fetchWithTimeout` with a 15-second timeout. This
    single file already holds every glossary entry, so the provider does not
    fetch or walk any index files.

2.  **Validate the response.** If the payload is missing or is not an array, the
    provider throws `"Glossary bundle is invalid or missing"`.

3.  **Deduplicate.** It builds a `Map` keyed by entry `id` and keeps the last
    entry for each id, so duplicate ids cannot appear in the final list.

4.  **Publish.** It stores the deduplicated array in state and clears any prior
    error.

The provider fetches only once. The effect returns early if the data has
already loaded, and a cancel flag ignores a late response after the provider
unmounts.

## The `enabled` prop

```tsx
interface GlossaryProviderProps {
  children: ReactNode;
  enabled?: boolean; // defaults to true
}
```

`enabled` defers the fetch until the glossary or game shell actually needs it.
While `enabled` is `false`, the provider renders its children but does not load
the bundle. Set it to `true` to trigger the load.

## State and provided value

*   **`entries: GlossaryEntry[] | null`** — the shared glossary data. It is
    `null` before loading finishes, the full deduplicated array on success, and
    an empty array (`[]`) if the fetch fails.
*   **`error: string | null`** — the error message from a failed fetch, or
    `null`.

The context value is `entries` (`GlossaryEntry[] | null`). The provider does
**not** hold back its children while loading and does **not** render a loading
spinner. Consumers therefore receive `null` during loading and must handle that
case themselves.

## Usage

Wrap the part of the tree that needs glossary access with `GlossaryProvider`.

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
`null` while the bundle loads.

```tsx
import { useContext } from 'react';
import GlossaryContext from '../context/GlossaryContext';

const entries = useContext(GlossaryContext); // GlossaryEntry[] | null
```

## Error handling

If the fetch fails, the provider logs the error to the console, stores the
message in `error` state, and sets `entries` to an empty array. It then renders
`ErrorOverlay` in place of its children, so the message covers the screen and
the app does not continue with missing data.
