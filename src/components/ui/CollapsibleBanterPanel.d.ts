/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/07/2026, 07:57:19
 * Dependents: App.tsx, components/DesignPreview/steps/PreviewComponents.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This component is the primary UI interface for the 'Banter System'.
 * It handles the rendering of both ambient NPC-to-NPC banter and directed
 * NPC-to-Player conversations.
 *
 * Recent updates introduced the 'Player-Directed' mode, which adds visual
 * urgency (amber color schemes, pulsing tab, and response countdowns) when
 * an NPC is explicitly waiting for the player to interject or reply.
 *
 * It supports three layout modes: COLLAPSED (side tab), EXPANDED (side drawer),
 * and FLOATING (detached window).
 *
 * @file src/components/ui/CollapsibleBanterPanel.tsx
 * @component-owner Narrative Team / Core UI
 */
import React from 'react';
import { BanterMoment, Companion } from '../../types/companions';
export interface BanterHistoryLine {
    speakerId: string;
    speakerName: string;
    text: string;
    /** True when this line was a player-directed NPC opening or escalation. */
    isDirectedAtPlayer?: boolean;
}
interface CollapsibleBanterPanelProps {
    /** Extends the NPC-to-NPC inter-line wait by 60 seconds (gives the player more time to interject). */
    onExtendNpcDelay?: () => void;
    isActive: boolean;
    isWaiting: boolean;
    isGenerating?: boolean;
    generatingSpeakerName?: string | null;
    secondsRemaining: number;
    history: BanterHistoryLine[];
    archivedBanters: BanterMoment[];
    companions: Record<string, Companion>;
    onInterrupt: (message: string) => void;
    onEndBanter: () => void;
    /** True when the session is in PLAYER_DIRECTED mode. */
    isPlayerDirected?: boolean;
    /** True while waiting for the player to reply to a directed NPC line. */
    isWaitingForPlayerResponse?: boolean;
    /** Countdown seconds for the player response deadline. */
    playerResponseDeadlineSeconds?: number;
    /**
     * When flipped to true the panel expands automatically.
     * Driven by App.tsx when the attention banner's "Open Chat" is clicked.
     */
    forceExpand?: boolean;
    /** Extends the player response deadline by 60 seconds. */
    onExtendDeadline?: () => void;
    /**
     * Whether auto-banter generation is currently paused (disabled). Surfaced as a
     * dev-only status badge in the panel header so testers can see at a glance
     * whether ambient banter will fire. Has no effect when dev tools are off.
     */
    isBanterPaused?: boolean;
    /**
     * Toggles the paused state. When provided, the dev-only header badge becomes a
     * clickable button (the same control as the Banter & AI Inspector's Active/Paused
     * toggle); without it the badge is a read-only status pill.
     */
    onToggleBanterPause?: () => void;
    /**
     * Hides only the ambient collapsed launcher while another modal owns focus.
     * Expanded/floating chat state is preserved so active conversations are not
     * discarded just because the player opened a logbook or glossary window.
     */
    suppressCollapsedTab?: boolean;
}
export declare const CollapsibleBanterPanel: React.FC<CollapsibleBanterPanelProps>;
export {};
