# Architectural Task: Consolidate Type Definitions

Last Reviewed: 2026-03-12
Status: Preserved refactor note / partially superseded by later type modularization

## Purpose

This file preserves an architectural refactor proposal for reducing ambiguity and circular dependency pressure in the type system.
It should now be read as a preserved refactor note, not as a description of the current repo as if none of that modularization had happened.

## Verified Current State

A manual repo check during the 2026-03-12 doc pass confirmed:
- src/types/core.ts exists
- src/types/items.ts exists
- src/types/character.ts exists
- src/types/index.ts still exists as the barrel surface
- the type lane is already more modular than this older proposal assumed

## What The Proposal Still Captures Well

The preserved proposal still explains a real architectural concern:
- type barrels can become ambiguous and heavy
- circular dependency pressure between index-style exports and domain files is worth watching
- type modularization is a legitimate maintenance direction

## What Drifted

The repo no longer fits the original all-or-nothing framing exactly.
The presence of core.ts, items.ts, and character.ts means that some of the proposed split has already happened.
That makes this file more useful as historical refactor rationale than as a literal current task list.

## Current Reading Rule

Use this file as preserved rationale for why the type lane was pushed toward modularization.
For current implementation truth, inspect the live files under ../../src/types/.
