/**
 * This file proves the Logbook reducer keeps the player's discovery memory bounded and honest.
 *
 * The discovery log is the player's record of places, items, quests, and events.
 * These tests pin the retention and unread-count rules so long campaigns do not
 * silently grow save data forever or show a badge count that no longer matches
 * what the player can actually open.
 */
export {};
