/**
 * @file src/utils/combat/xpForChallengeRating.ts
 * Maps a monster's Challenge Rating to its XP value per the 5e Monster Manual /
 * 2024 rules. Replaces the old flat "50 XP per enemy" placeholder so a CR 1/4
 * goblin and a CR 3 ogre are worth appropriately different amounts, and so the
 * pace to level 3 tracks the fights the player actually wins.
 */
/**
 * XP awarded for defeating a monster of the given Challenge Rating.
 * Accepts the fractional string forms ('1/8', '1/4', '1/2'), decimal forms,
 * or a whole-number CR (string or number). Unknown/malformed CRs yield a small
 * non-zero floor so a defeated foe is never worth literally nothing.
 */
export declare function xpForChallengeRating(cr: string | number | null | undefined): number;
