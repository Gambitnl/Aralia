/**
 * ARCHITECTURAL CONTEXT:
 * This test suite validates the 'Noble House' procedural generation
 * system. It ensures that houses are created with consistent hierarchies
 * (Head/Spouse), valid stats, and internal 'Secrets' for the Intrigue system.
 *
 * Recent updates focus on 'Seed Predictability'. By passing an explicit
 * incrementing seed in loops rather than relying on the system clock,
 * the tests can reliably exercise a wide range of house configurations
 * in a short time window.
 *
 * @file src/systems/intrigue/__tests__/NobleHouseGenerator.test.ts
 */
export {};
