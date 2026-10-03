/**
 * @file AgentSim3DPreview.tsx — standalone 3D proof for the agent-walking render.
 *
 * Reachable at `?phase=agentsim3d`. A self-contained R3F scene (no chunk streaming,
 * no game session) that builds a demo town + roster, wraps it in a minimal
 * GroundWorld, and renders the real `<GroundAgents>` InstancedMesh over a flat
 * plane with the town's building plots as low boxes. Scrub the clock and the
 * townsfolk walk the streets between buildings — the in-3D counterpart to the 2D
 * `?phase=agentsim` preview, reachable WITHOUT the load-save → Enter-3D → click-cell
 * chain (which the headless preview can't drive). Light enough to screenshot.
 */
import React from 'react';
declare const AgentSim3DPreview: React.FC;
export default AgentSim3DPreview;
