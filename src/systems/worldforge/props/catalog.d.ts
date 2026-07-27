/**
 * @file catalog.ts — FULL prop catalog for the Beautification Wave.
 *
 * Source of truth: docs/superpowers/research/2026-07-03-prop-catalog-strawman.md
 * (all 16 context tables). Referee data is transcribed VERBATIM from the
 * strawman; this file is Remy-editable CONTENT. `WAVE1_PROPS` keeps the
 * original 14 backbone defs; `EXPANDED_PROPS` carries the rest of the strawman;
 * `PROP_CATALOG` / `PROPS_BY_ID` are the full set.
 *
 * Material mapping note: the strawman uses "organic" for plant matter, which is
 * not in `MaterialType`. Per propSchema.ts, organic → 'wood'. Boulders / logs
 * are "solid"; hollow props (crate/barrel) carry WALL thickness.
 * Non-plant "organic" heaps (dung, refuse) map to 'dirt' — treating muck as
 * wood would give it silly spell-penetration; noted per entry.
 *
 * A prop that appears in several contexts (crate, barrel, cart…) is ONE
 * definition with a union of placement tags — that reuse is exactly why these 14
 * are WAVE-1. Where the strawman gave a prop different sight/cover in different
 * rows (a crate "y (if stacked)"), the standalone form is taken and the stacked
 * form lives in its own def (`crate-stack`).
 *
 * ── Expansion merges (strawman rows folded into ONE def; decided here) ───────
 *  • fountain            = market "Fountain / market cross" + wealthy
 *                          "Ornamental well / fountain" (same referee row).
 *  • lantern-post        = tavern lantern post + wealthy wrought variant
 *                          (variant selector picks the form).
 *  • statue              = wealthy "Statue / plinth" + graveyard
 *                          "Statue (saint/mourner)".
 *  • brazier             = gate "Guard brazier" + graveyard "Offering brazier /
 *                          candle stand".
 *  • grindstone          = smithy grindstone + farmstead spare millstone.
 *  • iron-fence          = wealthy "Wrought-iron fence + gate" + graveyard
 *                          "Iron fence rail".
 *  • chicken-coop        = poor-quarter hutch + farmstead coop.
 *  • rock-outcrop        = rocky-hills "Rock outcrop / crag" + defile
 *                          "Concealing crag (full cover)".
 *  • rubble-pile         = ruin rubble + defile "Rockfall / rubble choke".
 *  • bramble-patch       = forest bramble + ruin "Bramble-choked doorway".
 *  • milestone / wayside-shrine — village-lane + road/trailside rows.
 *  Poor-quarter "broken fence", "cracked water butt", "handcart (broken)" and
 *  defile "dense thicket" / "fallen log (barricade)" reuse WAVE-1 defs
 *  (fence-run / barrel / cart / bush / fallen-log) via placement tags.
 */
import type { PropDefinition } from './propSchema';
/** The 14 WAVE-1 prop definitions, in strawman table order. */
export declare const WAVE1_PROPS: readonly PropDefinition[];
/** Strawman entries beyond WAVE-1, grouped by first context, table order. */
export declare const EXPANDED_PROPS: readonly PropDefinition[];
/** The FULL catalog: WAVE-1 backbone + the expanded strawman set. */
export declare const PROP_CATALOG: readonly PropDefinition[];
/** Fast lookup over the FULL catalog (built once at module load). */
export declare const PROPS_BY_ID: ReadonlyMap<string, PropDefinition>;
/**
 * Fast lookup for the WAVE-1 backbone only. The GroundWorld bridge (rendering +
 * referee imprint) still keys off THIS map — expanded defs stay data-only until
 * the wiring packet switches the bridge to `PROPS_BY_ID`.
 */
export declare const WAVE1_PROPS_BY_ID: ReadonlyMap<string, PropDefinition>;
/** All placement tags present in the FULL catalog (deduped, sorted). */
export declare function allPlacementTags(): string[];
