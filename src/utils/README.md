# Utilities Directory (`src/utils/`)

## Purpose

The `src/utils/` directory is intended to house general-purpose utility functions and helper modules that are used across different parts of the Aralia RPG application. These utilities are typically pure functions or small modules that don't fit neatly into the `components/`, `services/`, or `data/` categories.

## Contents

Currently, this directory may contain modules such as:

*   **`characterUtils.ts`**: Utility functions related to player character data, such as calculating ability score modifiers. See `src/utils/characterUtils.README.md`.
*   Other utility modules as the project grows (e.g., for string manipulation, common calculations, formatting, etc.).

## Guidelines

*   Keep utilities small and focused on a specific task or domain.
*   Ensure functions are well-documented, especially if their logic is complex.
*   Strive to make utility functions pure (i.e., given the same input, they always return the same output and have no side effects) where possible, as this improves testability and predictability.
*   Each significant utility module (e.g., `characterUtils.ts`) should have its own corresponding `[moduleName].README.md` file.
