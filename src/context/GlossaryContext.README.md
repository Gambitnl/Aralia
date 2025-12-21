# GlossaryContext

## Purpose

The `GlossaryContext.tsx` module provides a React Context for managing and distributing the entire game's glossary data. Its primary responsibility is to fetch all glossary index files—**including nested indexes**—consolidate them into a single, comprehensive data structure, and make this data available to any component that needs it, most notably the `Glossary.tsx` component.

This approach ensures that the glossary data is loaded only once and is centrally managed, preventing prop-drilling and simplifying data access for consumer components.

## Core Functionality

The `GlossaryProvider` component performs the following steps when it mounts:

1.  **Fetch Main Index**: It first fetches the main index file located at `/public/data/glossary/index/main.json`. This file contains a list of paths to all top-level category-specific JSON index files.

2.  **Recursively Fetch and Process Indexes**:
    *   It uses a recursive function, `fetchAndProcessIndex`, to handle each file path.
    *   If a fetched file is a **nested index** (identified by having an `index_files` key, like `rules_glossary.json`), the function calls itself for each path listed within that file.
    *   If a fetched file is a **data file** (identified by being a simple array of `GlossaryEntry` objects), it returns the array of entries.
    *   This allows for a hierarchical and modular organization of the glossary data.

3.  **Consolidate and Deduplicate Data**: All entries from the various files (including those from nested indexes) are flattened and combined into a single array of `GlossaryEntry` objects. A `Map` is used to ensure each entry ID is unique in the final list, preventing duplicates from causing issues.

4.  **Provide Data**: The final, consolidated array of `GlossaryEntry` objects is made available through the context provider's value.

## State Management

*   **`entries: GlossaryEntry[] | null`**: Holds the consolidated glossary data. It is `null` initially while loading, an empty array (`[]`) if an error occurs, and the full array of `GlossaryEntry` objects upon successful loading.
*   **`error: string | null`**: Stores any error message that occurs during the fetching process.

## Provided Context Value

Components consuming this context will receive:
*   An array of `GlossaryEntry` objects on success.
*   The Provider handles loading and error states internally, displaying a `LoadingSpinner` or `ErrorOverlay` respectively. It does not render children until data is available or an error has occurred (and been displayed).

## Usage

The `GlossaryProvider` should wrap the root `App` component or any part of the component tree where glossary access is needed.

**Example (in `App.tsx`):**
```tsx
import { GlossaryProvider } from './context/GlossaryContext';

const App: React.FC = () => {
  return (
    <GlossaryProvider>
      {/* ... rest of the application ... */}
      <Glossary isOpen={isGlossaryOpen} ... />
    </GlossaryProvider>
  );
};
```

Any descendant component can then access the glossary data using the `useContext` hook:
```tsx
import GlossaryContext from '../context/GlossaryContext';
// ...
const glossaryIndex = useContext(GlossaryContext);
// ...
```

## Error Handling

If any of the fetch operations fail, the context sets its internal `error` state. The Provider then renders an `ErrorOverlay` component covering the screen, preventing the application from proceeding with incomplete or missing data. This ensures the user is aware of critical data loading failures.