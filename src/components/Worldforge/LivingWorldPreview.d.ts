/**
 * LivingWorldPreview (?phase=livingworld) — Plan F: the play-and-eyeball surface
 * (SPEC D12) for the living-world town sim.
 *
 * Generates a demo town, tags its key NPCs (Plan B), seeds the life-event sim
 * (Plan A), advances it N years (Plan C registry), and renders the resulting
 * Town Chronicle + current institution-holders. No playing session required.
 *
 * Headless proof: window.__livingWorldPreview.{ setSeed, setYears, setPopulation,
 * current() } drives it and reads back stats for automated verification.
 */
import React from 'react';
declare const LivingWorldPreview: React.FC;
export default LivingWorldPreview;
