/**
 * @file BanterAttentionBanner.tsx
 *
 * Floating centre-bottom banner that appears when a companion NPC addresses the
 * player directly during PLAYER_DIRECTED banter mode.
 *
 * Shows:
 *  - The NPC's name and a truncated version of their opening line
 *  - A countdown to the response deadline
 *  - An "Open Chat" button that expands the banter panel
 *  - A "Dismiss" button to hide the banner without ending banter
 *
 * Auto-fades after 10 seconds of inactivity (the banter panel tab still pulses).
 * @component-owner Narrative Team / Core UI
 */
import React from 'react';
interface BanterAttentionBannerProps {
    /** Name of the NPC who spoke. */
    speakerName: string | null | undefined;
    /** The directed line the NPC said (truncated if long). */
    lastLine: string | null | undefined;
    /** Seconds remaining for the player to reply. */
    deadlineSeconds: number;
    /** Called when the player clicks "Open Chat". */
    onOpenChat: () => void;
    /** Extends the player response deadline by 60 seconds. */
    onExtendDeadline?: () => void;
}
export declare const BanterAttentionBanner: React.FC<BanterAttentionBannerProps>;
export {};
