/**
 * Unit tests for the disposition-gated recruit consent verdict (P5).
 *
 * Validates that evaluateRecruitOffer:
 *   - auto-accepts when opts.autoAccept is set (rescue short-circuit).
 *   - gates an already-met companion on relationship LEVEL (friend+ joins).
 *   - declines an active party member ("already with you").
 *   - gates a first-time recruit on NPC disposition (>= threshold joins).
 *   - never mutates the inputs and always returns a human-readable reason.
 *
 * Runs on: vitest.
 * Depends on: recruitConsent (pure module) + RelationshipManager thresholds.
 */
export {};
