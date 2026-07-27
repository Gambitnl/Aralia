/**
 * Corpus gate: compiles every shipped glossary entry and asserts the build
 * gate is clean. This is the same check scripts/glossary/compile-glossary.ts
 * enforces in the build; running it in vitest means a broken entry fails
 * `npm test` locally too, not just the Pages build.
 */
export {};
