/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/__tests__/worldReducer.timeBoundary.test.ts
 * Day-boundary regression tests for the ADVANCE_TIME "Chronos Loop".
 *
 * Time gap G2 (absorbed: docs/superpowers/specs/2026-07-14-absorbed-time.md,
 * planmap topic generational-time): world and ritual reducers mix
 * pre/post-advance timestamp usage, which makes edge-case ordering at the
 * day boundary hard to reason about. These tests are TEST-ONLY — they import
 * worldReducer and ritualReducer read-only and lock in the current, observable
 * behavior of a time step that crosses a game-day boundary, so any future
 * reordering of that pipeline (advance clock -> tick ritual -> daily sim) shows
 * up as a failed assertion rather than a silent semantic drift.
 */
export {};
