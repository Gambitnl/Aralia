import React from 'react';
import type { TownPlan } from '../../systems/worldforge/artifacts';
import type { TownRoster } from '../../systems/worldforge/roster/types';
export interface TownAgentSnapshotViewProps {
    plan: TownPlan;
    roster: TownRoster;
    /** Hour of day, 0–23 (the schedule wraps out-of-range values). */
    hour: number;
    /**
     * Optional FRACTIONAL clock (hours, e.g. 7.5). When set, agents are placed with
     * continuous street motion (`townMotionSnapshotAt`) instead of snapping to plot
     * centroids — commuters are drawn walking the streets. Overrides `hour`.
     */
    clock?: number;
    /**
     * Externally-driven agents (e.g. the WF-AGENTSIM behaviour layer), already in
     * plan/feet coords with a per-agent colour. When provided, these are rendered
     * INSTEAD of the schedule snapshot — so a needs/decision sim can place people
     * wherever it decides, coloured by activity. Streets still draw for context.
     */
    externalAgents?: Array<{
        occupantId: number;
        x: number;
        y: number;
        colorHex: string;
    }>;
    /** Hover/click an agent dot to inspect it. Fires the occupant id (null on leave). */
    onHoverAgent?: (occupantId: number | null) => void;
    onClickAgent?: (occupantId: number) => void;
    /** Occupant id to highlight (hovered/selected) with a ring. */
    highlightId?: number | null;
    width?: number;
    height?: number;
}
declare const TownAgentSnapshotView: React.FC<TownAgentSnapshotViewProps>;
export default TownAgentSnapshotView;
