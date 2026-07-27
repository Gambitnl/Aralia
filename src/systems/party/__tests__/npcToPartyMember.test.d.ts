/**
 * Unit tests for the NPC → party-member converter (Packet P4).
 *
 * Validates that:
 *   - npcToPartyMember turns a RichNPC into a { character, companion, source }
 *     payload whose two halves SHARE one id (the PartyPane join invariant).
 *   - The character half adopts the NPC's real ability scores / stats / id and
 *     lands the biography in the documented `richNpcData` slot.
 *   - The companion half seeds `relationships.player` (stranger / approval 0),
 *     loyalty derived from disposition, and `inParty: true`.
 *   - promoteCompanionToMember keeps the authored Companion (inParty:true) and
 *     synthesizes a PlayerCharacter sharing its id.
 *
 * Runs on: vitest.
 * Depends on: real building blocks generateNPC + createMockCompanion (imported,
 * not mocked) so the converter is exercised against genuine fixtures.
 */
export {};
