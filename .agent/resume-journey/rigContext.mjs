// Shared browser-context setup for the resume-journey rigs.
//
// WHY THIS EXISTS: the saved session lives in `storageState.json`, and a
// Playwright storage state is keyed BY ORIGIN. That file was captured on
// http://localhost:5174, so seeding it into a run against any other port
// (the canonical dev port 3000, or an auto-ported 5175 when 5174 is taken)
// silently seeds NOTHING — the app then correctly reports "No chronicles
// found" and the rig looks broken when it is only pointed at the wrong door.
//
// So: one place decides the base URL, and the seed state is rewritten to that
// run's origin in memory. Nothing on disk changes.
//
// Override the target with BASE_URL, e.g.
//   BASE_URL=http://localhost:5174/Aralia/ node .agent/resume-journey/audit.mjs
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The app URL every resume-journey rig loads. Defaults to vite's own port. */
export const BASE = process.env.BASE_URL ?? 'http://localhost:3000/Aralia/';

/** The captured session (autosave + slot index) the rigs resume from. */
export const SEED_STATE_FILE =
  process.env.SEED_STATE ??
  path.join(__dirname, '..', '3d-visual-quality', 'captures', 'storageState.json');

/**
 * Browser-context options carrying the saved session, with every seeded origin
 * rewritten to BASE's origin. Returns `extra` untouched when no seed file
 * exists — the caller's own warning then explains an empty main menu.
 *
 * The app migrates a seeded localStorage save into IndexedDB on startup, so
 * seeding localStorage is still the correct and only thing a rig has to do.
 */
export function seededContextOptions(extra = {}) {
  if (!fs.existsSync(SEED_STATE_FILE)) return { ...extra };

  const state = JSON.parse(fs.readFileSync(SEED_STATE_FILE, 'utf-8'));
  const targetOrigin = new URL(BASE).origin;
  for (const entry of state.origins ?? []) entry.origin = targetOrigin;

  return { ...extra, storageState: state };
}

/** True when the seed session file is present. */
export const hasSeedState = () => fs.existsSync(SEED_STATE_FILE);

/**
 * Chromium launch options for every resume-journey rig.
 *
 * Set HEADED=1 to watch the run in a real window instead of headless — the
 * default for work you want to follow live:
 *   HEADED=1 node .agent/resume-journey/roundtrip.mjs
 *
 * The software-GL flags stay on in both modes so headed and headless runs
 * render the same 3D surface.
 */
export const launchOptions = (extra = {}) => ({
  headless: !process.env.HEADED,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  ...(process.env.HEADED ? { slowMo: Number(process.env.SLOWMO ?? 150) } : {}),
  ...extra,
});
