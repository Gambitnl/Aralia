# Architect's Journal

## 2024-05-23 - Separating Dev Controls **Learning:** Complex components often accumulate development tools that persist in production code, bloating the file. Extracting these into a dedicated component with a clear interface simplifies the main component and makes the dev tools easier to maintain or toggle. **Action:** When identifying God components, look for conditional rendering blocks like `isDevMode` or `isDummy` as primary candidates for extraction.
