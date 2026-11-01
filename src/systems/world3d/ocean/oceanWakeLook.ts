/**
 * @file oceanWakeLook.ts
 * The original wake look controls, experiment history and named presets.
 * Every scientific note, unfinished option and preset value stays intact.
 * Parsing keeps the same defaults and return order; no visual choice is retuned.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:15:52
 * Dependents: systems/world3d/ocean/oceanWakeMath.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { WAKE_LACE_WEIGHTS } from './oceanWakeTextures';


/* ------------------------------------------------------------------ */
/* The look's controls (round 4)                                       */
/* ------------------------------------------------------------------ */

/**
 * THE LOOK'S CONTROLS. Round 2's read of the lace won the chase view blind
 * in both orders. Round 3 changed it in seven places for the quarter view
 * and lost both views: the chase view's core became "a see-through milky
 * haze". Each round-3 change now sits behind one field of this record, and
 * at the field's round-2 value the read in oceanWake.ts is round 2's node
 * for node (`WAKE_LOOK_ROUND2`; the proof is the round-4 capture against
 * the round-2 frame). `WAKE_LOOK_ROUND3` names round 3's values, so a
 * capture rig can show either build from the same file (`parseWakeLook`,
 * read by the viewer mount from `&wakelook=`). The default is
 * `WAKE_LOOK_ROUND4`: round 2's read plus the round-4 fields that shape
 * the quarter view by the trail's age, which the chase view's judged crop
 * cannot see (see each field).
 *
 * The fields, round 2 -> round 3:
 *   laceWeights    the lace mix; the streaks at 0.22 -> 0.1.
 *   holeStretch    the raft's holes drawn out along the flow, 1.8 -> 1.3.
 *   streakStretch  the streaks drawn out along the flow, 3 -> 2.
 *   subGain        the submerged lace's weight in the bubble cloud,
 *                  0.75 -> 0.55.
 *   corePocketLo   the alpha a pocket of the churn keeps, 0.25 -> 0.08.
 *   corePocketRamp the raft rank over which a pocket opens,
 *                  [0.12, 0.42] -> [0.1, 0.3].
 *   pocketsGlow    the pockets lit as submerged bubbles (round 2) or left
 *                  as dark water (round 3).
 *   coreGrain      round 3's bubble speckle in the core (off in round 2).
 *   foamVolume     round 3's `foamShade` (thin edges and shaded heaps; off
 *                  in round 2, where the factor is 1).
 *   backfaceCap    round 3's cap of the wake's slope away from the eye, as
 *                  a share of the view ray's elevation; 0 is off (round 2).
 *
 * Round 4's fields, for the quarter view; each is off at its default, and
 * off adds no node (see the read in oceanWake.ts):
 *   backfaceKnee   the share of the view ray's elevation under which the
 *                  cap leaves the slope alone. Round 3 capped from zero
 *                  (knee 0) and so bent every slope the chase view sees;
 *                  with the knee near the elevation, only a slope that
 *                  would turn a facet away is bent.
 *   jacGatherMax   the most the sea's folding gathers the cover (1 / J).
 *   ageShade       [t0, t1, floor, peak]: the foam's own light by the
 *                  trail's age in seconds (the distance behind the transom
 *                  along the course over the hull's speed, from the
 *                  breaking buffer: a world-space key, never the camera):
 *                  `peak` up to t0, `floor` from t1 on. Off at floor 1,
 *                  peak 1.
 *   ageOpacity     [t0, t1, floor]: the foam's opacity by the same age:
 *                  1 up to t0, `floor` of it from t1 on, so old foam is a
 *                  see-through film. Off at floor 1.
 *   wispAge        [t0, t1]: the wisps' second key: all of the drawn-out
 *                  read from t1 on, none up to t0. Off at a negative t0.
 *   laceSharp      0 to 1: how far the lace's soft ramp narrows where a
 *                  pixel resolves the holes (a footprint under
 *                  SHARP_FOOT_M in the read), for crisp threads around
 *                  dark holes.
 *   coreSharp      the same, in the core only (weighted by the core's
 *                  share of the amount).
 *   wispStretch    a second read of the raft, drawn out this many times
 *                  along the flow, mixed in where the amount is thin
 *                  (`wispRange` [lo, hi]: all of it under lo, none over
 *                  hi; off when hi is not over lo) or where the trail is
 *                  old (`wispAge`): thin foam is sheared into long wisps.
 *                  0 is off.
 *   streakJitter   how far the streaks' ribbons wander across the flow
 *                  with the clumps, in ribbon widths, so they are not
 *                  evenly spaced. 0 is off.
 *   edgeStreaks    how much the thin-foam gate follows the streaks, so a
 *                  trail's edge breaks into ribbons along the flow rather
 *                  than a cut. 0 is off.
 *
 * Round 5's fields. The quarter view's crop and the chase view's crop show
 * the SAME water (foam 0.5 to 4 s old; `wake/r4/age-map-quarter.png`), so
 * the structure below (clumps, flecks, pinholes, the rim, the pile, the
 * tail) is a property of the water and applies at EVERY view, world-space
 * only: a player who orbits the boat sees one wake (the lead's ruling on
 * round 5, which had gated the structure on the view and so tuned the
 * chase crop to 0 of it; the fault class of GG-311). What DOES depend on
 * the view is how the lace's anisotropy lands on screen: a hole drawn out
 * 1.8 times along the flow is seen along the flow (chase) at about 1.1
 * times, foreshortened, and across it (quarter) at 3 to 4 times, the
 * quarter critics' "one uniform brush direction". That alone is keyed on
 * `sideR` = meters per pixel across the flow over meters per pixel along
 * it, for the flat sea plane (`wakeSideRatio`: with the camera h up, d out
 * and phi off the flow, r^2 = (h^2 + d^2 sin^2 phi) / (h^2 + d^2 cos^2
 * phi)): 0.55 to 0.8 at the chase pose, 1.24 to 2.2 at the quarter pose,
 * through `sideW` = smoothstep(sideKey[0], sideKey[1], sideR). Like
 * anisotropic filtering it changes only how the same lace samples on
 * screen: the mixed read is re-equalized (`wakeMixUniformCdf`) so the
 * cover at a given amount is the same at every view (the orbit proof,
 * `wake/r5b/orbit-*.png`).
 *   sideKey        [r0, r1]: the ramp of the key on sideR (sideStretch
 *                  only).
 *   sideStretch    [holes, streaks]: second reads of the raft and the
 *                  streaks at these stretches along the flow, mixed in by
 *                  sideW and re-equalized. 0 off.
 *   clumpTear      [lo, hi, strength]: a REMOVAL-ONLY tear, at every
 *                  view. The cover keeps itself where the clumps channel
 *                  is over hi and loses `strength` of itself under lo, so
 *                  the mat breaks into separate clumps with ragged borders
 *                  (the clumps are five octaves), never in the core. 0
 *                  strength off.
 *   clumpTearAge   [t0, t1]: the tear's strength ramps up with the
 *                  trail's age between t0 and t1 s (a thinning tail);
 *                  t1 not over t0 is the full strength at every age.
 *   clumpTearTile  meters per tile of the tear's own read of the clumps
 *                  channel; 0 reads the lace's clumps at their 23 m tile.
 *   clumpTearAmt   [a0, a1]: the tear is full where the amount is under
 *                  a0 and off over a1, so the band's middle stays a whole
 *                  mat and its edges and tail break into islets (the
 *                  reference's mat is continuous, torn at its edges);
 *                  a1 not over a0 is the full tear at every amount.
 *   fleckKeep      the raft rank over which a fleck survives the tear (the
 *                  raft's peaks as scattered flecks between the clumps);
 *                  1 keeps none.
 *   sideSharp      0 to 1: the lace's ramp narrows where a pixel resolves
 *                  the holes (laceSharp's footprint key), at every view:
 *                  high-contrast borders.
 *   pinholes       [strength, tileM]: small dark holes cut out of the
 *                  white where the raft at tileM is at its peaks (the top
 *                  sixth), removal only, where a pixel resolves them, at
 *                  every view: the grain inside the white. 0 strength off.
 *   darkRim        [strength, shade]: the band of lace just under the
 *                  threshold, outside a patch (SUB_REACH of rank), draws
 *                  as thin foam at `shade` of the foam's light instead of
 *                  the submerged glow: a darker, disturbed rim where foam
 *                  meets clear water, outside the core, at every view. 0
 *                  strength off.
 *   crestPile      [gain, h0]: the amount rises by gain where the wake's
 *                  own height is +h0 and falls by it at -h0: foam piles on
 *                  the crests and drains from the troughs, at every view.
 *                  0 gain off.
 *   sideFade       [t0, t1, floor]: the amount falls to `floor` of itself
 *                  as the trail ages from t0 to t1 s: a thinning tail
 *                  behind the core, at every view. floor 1 off.
 *
 * Round 6's fields. The round-5b critics named one structure at both
 * views: a bright opaque core at the stern that opens, within a boat
 * length, into lace with dark windows of many sizes drawn out along the
 * flow, then into translucent streaks, with soft haze edges and no glints
 * anywhere in the wake. Every field keys on world space only (the trail's
 * age, its offset from the track, the wake's own amounts); each is off at
 * its off value and off adds no node, so `r5` draws round 5b to the pixel.
 *   laceFold       [t0, t1, share]: the lace's rank r is folded to
 *                  1 - |2 r - 1| as the trail ages from t0 to t1 s (up to
 *                  `share` of the cover). The fold of a uniform rank is
 *                  uniform again, so an amount a still covers a; but the
 *                  foam now lies along the median contour of the mixed
 *                  noise, a network of filaments around windows of both
 *                  its highs and its lows, of every size the noise has:
 *                  lace, where the unfolded threshold drew blobs with a
 *                  few holes ("soft, cottony blobs with no interior").
 *                  0 share off.
 *   haze           [alpha, reach, shade, a0, a1]: a soft bubble haze in the band
 *                  of lace `reach` of rank under the threshold, at up to
 *                  `alpha` and `shade` of the foam's light, outside the
 *                  cover: the soft fringe where foam meets clear water,
 *                  in place of a hard cut edge, where the amount passes
 *                  from a0 to a1 (round 6: 0 to 0.25; its haze drew the
 *                  net's faint outlines over the open water beside the
 *                  trail). 0 alpha off.
 *   glintSlick     [strength, lo, hi]: the share of the sea's specular
 *                  that survives, returned as the reader's `glint`:
 *                  (1 - foam) (1 - strength smoothstep(lo, hi, s)), s the
 *                  larger of the wake's white-water amount and its bubble
 *                  cloud. Churned water is matte foam over a slick that
 *                  damps the short waves, so the glints die across the
 *                  whole lane, not only under solid foam ("glint
 *                  confetti"). 0 strength off: the surface uses 1 - foam.
 *   edgeLines      [gain, spread, widthM, tauS]: two lines of white water
 *                  where the hull's sides shed their water, from the
 *                  transom's corners (half-breadth transomShare B / 2)
 *                  out at `spread` meters per meter behind the transom,
 *                  Gaussian of `widthM` across, their amount `gain`
 *                  e^(-age / tauS): the wake's two firmer outer edges,
 *                  which widen as the trail ages. 0 gain off.
 *   envelope       [spread, m0, m1, keep]: the turbulent wake's edge, from
 *                  the transom's corners out at `spread` meters per meter
 *                  behind the transom; the amount from m0 to m1 meters past
 *                  it falls to `keep` of itself, so the thin foam the
 *                  wake's own crests spill outside the churn no longer
 *                  makes the trail widest at the stern. keep 1 off.
 *   laceNet        [t0, t1, share, stretch, scale]: the net lace
 *                  (`wakeNetImage`, its tiles WAKE_NET_TILE_M times `scale`,
 *                  walls round windows of many sizes, drawn out `stretch`
 *                  times along the flow) takes the raft's place in the
 *                  cover as the trail ages from t0 to t1 s, up to `share`.
 *                  The fold above drew the same topology but traced a
 *                  ring round every popped cell of the raft (a doily),
 *                  so the net draws the walls directly. 0 share off.
 *   backSlope      [strength, lo, hi]: on the back slope of the wake's own
 *                  waves (its slope along the direction of motion, the
 *                  water falling away aft) the amount loses up to
 *                  `strength` of itself as that slope passes from lo to
 *                  hi: a breaking lip on the stern wave's crest and dark
 *                  water behind it. From 0 (a first build) the trail's
 *                  own gentle transverse waves, 0.1 and under, lost
 *                  their foam in bands across the chase view, so lo
 *                  leaves them alone. 0 strength off.
 *
 * Round 7's fields (the round-6 quarter critics: "one thick, solid-white
 * churned band along the wake line that breaks into lace only at its
 * edges and farther back", soft see-through strand edges, a milky
 * aerated glow under and around the foam). World space only; off, each
 * adds no node, so `r6` draws round 6 to the pixel.
 *   coreBand       [r0, r1, delayS, backIn]: the structure's age key (the net, the
 *                  fade, the film, the tear, the foam's light) is the
 *                  trail's age less delayS within r0 of the churn's width
 *                  from the track, falling to none by r1: the middle of
 *                  the trail stays a solid core longer than its edges;
 *                  and backSlope's cut and the crest pile's drain in a
 *                  trough keep only backIn of themselves in the band. 0
 *                  delay off.
 *   netSoft        the net's own cover ramp, half-width in rank, in place
 *                  of the sharpened one: soft, see-through wall flanks.
 *                  0 off.
 *   aerate         [gain, reach, milk, shaped]: the bubble cloud's weight gains
 *                  `gain` as the wake's own white-water amount passes 0 to
 *                  `reach`, and its light moves `milk` of the way to a
 *                  paler, whiter glow: milky churned water under and
 *                  around the foam. 0 gain and 0 milk off. With `shaped`
 *                  1 (round 8) the key is the amount after the read's
 *                  cuts, so the gaps it opens are clearer water.
 *
 * Round 8's fields (the round-7 critics at both views: the fresh core "a
 * blown-out, textureless white smear"; the quarter view's foam "like a
 * decal on one smooth swell", its holes round and of one size). World
 * space only; off, each adds no node, so `r7` draws round 7 to the pixel.
 *   coreBoil       [dark, tileM, lightLo, grainLo, reach]: in the core, the
 *                  raft at a tileM tile drawn out twice along the flow:
 *                  under `reach` of its rank (fully under 0.4 of it) the
 *                  alpha and the whole glow lose `dark` of themselves
 *                  (dark upwelling boils); elsewhere the foam's
 *                  light runs from lightLo to 1 (clumps); a bubble grain
 *                  at 1.1 m runs it from grainLo to 1 where a pixel
 *                  resolves it. 0 dark, 1 lightLo and 1 grainLo off.
 *   churnSlope     [gain, tileM, tauS]: the lane's own turbulent lumps:
 *                  the clumps channel's gradient at a tileM tile tilts
 *                  the surface by up to about `gain` where the wake's
 *                  white water is, fading with the trail's age over
 *                  tauS. 0 gain off.
 *   netFine        [stretch, scale]: the fine net's own stretch along
 *                  the flow and tile scale; 0 takes laceNet's.
 *
 * Round 9's fields (the round-8 quarter critics: "a uniform, one-direction
 * smear of white strokes, like a motion-blurred texture"; "flat like a
 * decal ... no bright top and shadowed underside and no clumps").
 *   sideNet        [coarse, fine]: second reads of the coarse and the fine
 *                  net at these stretches along the flow replace the
 *                  first by sideW (sideKey on the flat-plane pixel ratio),
 *                  the rank re-equalized: the net's stretch bounded on
 *                  screen, the filtering-like key of sideStretch, with
 *                  the same orbit proof. 0 off.
 *   clumpShade     [rim, reach, flank]: the foam's light is 1 - rim at the
 *                  lace's threshold, 1 by `reach` of rank over it, and a
 *                  heap's down-sun flank (the clumps' slope toward the
 *                  sun) loses up to `flank` more: a bright top and a
 *                  shaded rim and flank. 0 rim off.
 *   sideThin       [r0, r1, floor, t0, t1]: between r0 and r1 of the
 *                  churn's width from the track the amount falls to
 *                  `floor` of itself, growing in over t0 to t1 s of the
 *                  trail's age, before the edge lines: a dense core with
 *                  sparse sides. floor 1 off.
 *   bandFade       [t0, t1, floor]: in the core band (coreBand) the amount
 *                  falls to `floor` of itself from t0 to t1 s of the
 *                  trail's true age. floor 1 off.
 *
 * Round 10's fields (every quarter verdict since round 6: "a dense, nearly
 * solid white core along the wake line with large, irregular dark tears
 * in it"; seen from the side, any lace network reads as round cells).
 *   coreSolid      [share, tileM, void0, soft, grow, alpha, r0, r1, lightLo,
 *                  mottle, boils]: `mottle` of the light follows the raft
 *                  (a bubble mottle, light only); round 8's boils cut the
 *                  mass by `boils` of their share;
 *                  its own width is r0 to r1 of the churn's width from
 *                  the track (r1 not over r0: the core band's), its light
 *                  runs from lightLo to 1 over its heaps and at its voids'
 *                  rims. In the core
 *                  band where the amount is over 0.3 to 0.75, the lace
 *                  hands over (up to `share`) to a near-solid cover of
 *                  `alpha`, torn where the clumps channel at a tileM tile
 *                  (drawn out twice along the flow) is under a threshold:
 *                  void0, rising by up to `grow` with the trail's age and
 *                  toward the band's edge, over `soft` of the field. The
 *                  voids clear the glow. 0 share off.
 *   ridgeTear      the back slope's cut starts up to this much of slope
 *                  earlier or later with the same tear field: a ragged
 *                  top edge along the stern wave's crest; with coreSolid on,
 *                  the solid band's void threshold also rises by this on
 *                  the wake's own highest crests (0.35 to 0.6 m), so
 *                  the mass tears at the lip. 0 off.
 *   crestOut       the crest pile's gain outside the core band, as a
 *                  share of its gain inside it. 1 off.
 *
 * Round 11's fields (the round-10 critics: the dense churn "see-through
 * ... never reaches the solid white of fresh churn"; the voids "smooth,
 * glassy, clean-edged cutouts"; at the chase view "a blurry white smear
 * under a foggy haze column").
 *   coreOpacity    [t0, t1, alpha]: the solid band's alpha rises to
 *                  `alpha` and the reader returns its weight as the
 *                  surface's `opacity` share (the foam cap from 0.85 to
 *                  1), both falling from t0 to t1 s of the trail's age.
 *                  Off when t1 is not over t0: the field is left out.
 *   coreTear       [fine, scale, ring, clear]: a second read of the tear
 *                  field at 1 / scale of its tile mixed in by `fine`
 *                  (voids of many sizes, ragged edges); a lace ring over
 *                  `ring` of the field under each void's edge, where the
 *                  lace's own cover and alpha show; `clear` the share of
 *                  the glow a void clears (round 10: 0.8). 0 fine and 0
 *                  ring off.
 *   coreLace       [cover, soft]: inside the solid band the lace's own rank
 *                  is cut at `cover` over a ramp of `soft` of rank: the
 *                  mass is a dense lace with sharp small holes, torn by
 *                  the voids. 0 cover off.
 *   debugView      a capture aid, 0 off: the read draws a field as its
 *                  foam alpha (1 the amount / 2, 2 the age / 5 s, 3 the
 *                  cover, 4 the glint share, 5 the opacity share, 6 the
 *                  mass's thickness / 1.5, 7 the mass's weight, 8 its
 *                  light less 0.5, 9 its relief less 0.5; round 14's trail:
 *                  10 its cover, 11 its amount, 12 its rank, 13 its light
 *                  less 0.5), for the surface's foam view (`setDebug(2)`).
 *
 * Round 12's fields (a fresh builder after six quarter losses in a row;
 * every quarter verdict: "one continuous, dense, bright, near-opaque
 * churned band ... with volume ... torn by irregular soft-edged boils";
 * against ours: "an even lace of same-size round holes", "parallel
 * diagonal streaks", "flat decal lighting", "hard-edged dark blobs"). The
 * young trail is not a lace any more but a LAYER of foam of a varying
 * thickness (`wakeMassImage`), world space only (the trail's frame, its
 * age and its offset from the track): opaque where it is thick, a film
 * where it is thin, lit by its own slope, torn by boils that thin it
 * gradually. It covers the trail from the transom out to the wake's edge
 * (the transom's corners, widening), so the three lanes the quarter view
 * saw as parallel stripes (the core and the two edge lines, rounds 9 to
 * 11) are one band whose edges are its firmer parts; the lace takes over
 * past its edges and as it ages.
 *   mass           [share, tile1M, tile2M, stretch, amp1, amp2]: the layer
 *                  replaces the lace by up to `share` of its weight; its
 *                  heaps are read at two tiles (the coarse heaps and the
 *                  lumps on them), drawn out `stretch` times along the flow,
 *                  their thickness varying by amp1 and amp2 about the band's
 *                  density. 0 share off (the field adds no node).
 *   massBand       [spread, dens0, dens1, pres0, pres1, wisp]: r is the offset
 *                  from the track over the wake's edge (the transom's
 *                  half-breadth plus `spread` meters a meter behind it);
 *                  the density is full to r = dens0 and 0 by dens1; the
 *                  layer's weight over the lace is full to pres0 and 0 by
 *                  pres1. `wisp` moves the density's r by up to that much
 *                  with the vein field (drawn out along the flow), from
 *                  0.2 of the edge out: the layer's edge breaks into wisps
 *                  along the flow, not a clean curve (0 off).
 *   massAge        [peak, old, t0, t1, h0, h1]: the density is `peak` and
 *                  falls to `old` of it from t0 to t1 s of the trail's
 *                  age; the layer hands over to the lace from h0 to h1 s.
 *   massBoil       [rank, width, depth, center, fine]: a boil is where the
 *                  thickness field is under `rank` (plus `center` on the track,
 *                  where the race wells up, none by half the edge), over
 *                  `width` of rank: the thickness falls there by `depth`
 *                  of the density, so the foam thins gradually into the
 *                  water. `fine` of the field is the finer tile's read:
 *                  boils of many sizes.
 *   massVeins      [w0, w1, edge, soft, film, fine]: the layer's veins
 *                  (the texture's G: the zero set of a noise drawn out along
 *                  the flow, meandering lines of varying width) are where
 *                  it is under a width that grows from w0 at the transom to
 *                  w1 by 4 s of age, and by `edge` more toward the band's
 *                  edge, over `soft` of it; a vein keeps `film` of the
 *                  layer's alpha (a gray streak, not a cut) and its lip is
 *                  in shade; the fine read's veins are 0.7 as wide and
 *                  weigh `fine`. From above the layer is marbled, not a
 *                  slab; from the side the veins foreshorten into the dark
 *                  streaks along the reference's band. (The fine read is
 *                  turned 35 degrees off the trail's axis: along the axis
 *                  its tile repeated every 5 m down the trail, a tiled
 *                  look.)
 *   massPores      [rank0, rank1, edge, soft, film, tileM]: small holes
 *                  where a third read of the thickness, at a tileM tile
 *                  (turned 70 degrees off the trail's axis), is under a
 *                  rank that rises from rank0 at the transom to rank1 by
 *                  4 s of age and by `edge` more toward the band's edge,
 *                  over `soft` of rank; a pore keeps `film` of the layer's
 *                  alpha. The thin places of a noise, not cells: many
 *                  sizes and shapes, clustered, a bubbly layer from above
 *                  and fine gray flecks from the side. rank1 0 off (the
 *                  tap is left out).
 *   massLace       [share, cover0, cover1, edge, soft, film]: the popped
 *                  bubbles in the layer: the lace's own rank (the raft, the
 *                  clumps, the streaks and the patches of `wakeLaceImage`)
 *                  cut at a cover that falls from cover0 at the transom to
 *                  cover1 by 4 s of age, and by `edge` more toward the
 *                  band's edge, over `soft` of rank; a hole keeps `film` of
 *                  the layer's alpha, `share` of the cut applied. The holes
 *                  are round and bright-rimmed as popped bubbles are, of
 *                  many sizes (the raft's three sizes of cell and its
 *                  gaps), and few in the young layer: scattered, not an
 *                  even spread. (A cut of the thickness field itself drew
 *                  flat camouflage shapes at a sharp ramp and clouds at a
 *                  soft one.) 0 share off.
 *   massWisp       [gain, d0, d1]: where the layer is thin (its density
 *                  under d0, none of it over d1) the thickness gains `gain`
 *                  times (0.35 - the vein field): the thin foam gathers
 *                  along the vein lines, streaks and filaments drawn out
 *                  along the flow, where a thin layer of the thickness
 *                  field alone is round soft blobs (cotton); there the
 *                  thickness field's own swing is damped to 0.4 of itself.
 *                  0 off.
 *   massCrest      [cut, h0, h1]: on the wake's own highest crests (its
 *                  height from h0 to h1 m: the stern wave's crest across
 *                  the track) the thickness loses up to `cut` times (1.2
 *                  less 1.4 of the fine read's thickness): the layer thins
 *                  on the crest in some places and not in others, so the
 *                  crest's silhouette against the far water is ragged (the
 *                  quarter critics of rounds 8 to 10: "a hard, straight
 *                  foam edge along the ridge at the upper left"). 0 off.
 *   massSlope      [gain, floor] (round 13): the layer's light follows the
 *                  wake's own slope (its Lambert change against the sun,
 *                  clamped to 0.6 to 1.2, `gain` of it): the foam on the
 *                  stern wave's face away from the sun is dimmer, on its
 *                  sunward face brighter (both round-12 quarter critics:
 *                  "its brightness does not change with the wave slopes");
 *                  and the layer's whole light never falls under `floor`,
 *                  so foam in shadow stays white foam in shadow, not "a
 *                  dirty mid-gray". 0 gain and 0 floor off.
 *   massGlow       [keep, r0, r1, holes] (round 13): the whole bubble glow (the
 *                  cloud, the aerated glow and the submerged lace) keeps
 *                  `keep` of itself past r1 of the wake's edge from the
 *                  track, all of it inside r0: a turquoise glow under the
 *                  core and clearer, darker water between the core and the
 *                  arms (the round-12 chase critic: "a milky white veil lies
 *                  over the whole wake band, the gaps between the core and
 *                  the arms included"); and the layer's popped bubbles clear
 *                  `holes` of it, so they are dark water, not the lit
 *                  turquoise of the churn under the layer (the round-12
 *                  quarter critic: "sharp-edged open holes of darker
 *                  water"). keep 1 and holes 0 off.
 *   massSun        [gain, lo, hi] (round 13): the relief's light as the
 *                  slope toward the sun alone, 1 - gain (slope . sun) /
 *                  sun.y, clamped to lo and hi: its mean over the heaps is
 *                  1, so the sunward flanks are brighter and the far flanks
 *                  shaded about the layer's own white. (massLight's relief
 *                  divides by the normal's length too, so every slope that
 *                  does not face the sun is darker and the mean of the
 *                  layer's light fell to about 0.87: gray foam. Set
 *                  massLight's relief weight to 0 with this on.) 0 gain off.
 *   massGrain      [gain, r0, r1, speckLo, speckTileM, rim] (round 13):
 *                  the layer's light follows the lace's raft channel (its
 *                  gaps and popped cells, 0.2 to 3 m), 1 - gain where the
 *                  raft is under r0 and 1 over r1, so the white is aerated
 *                  and uneven where round 12's layer was smooth plates (the
 *                  mixed rank, with its clumps and patches, drew broad gray
 *                  blotches); `rim` (0: round 12's 0.22) is how much the
 *                  thin foam at a popped bubble's lip loses; and a bubble
 *                  speckle (the raft at a speckTileM tile) runs it from
 *                  speckLo to 1 where a pixel resolves it (a footprint under
 *                  0.15 to 0.4 m). Light only, never the cover: the holes
 *                  stay the popped bubbles and the boils. 0 gain and 1
 *                  speckLo off.
 *   massArms       [peak, r, width, tauS, floor0, floor1, t0, t1]: the
 *                  density across the trail is the core's (massBand), or
 *                  two arms of `peak` at r of the edge, Gaussian of `width`
 *                  across, fading as e^(-age / tauS), where they are the
 *                  greater: the hull's sides shed their water at the
 *                  transom's corners, the wake's firmer outer edges that
 *                  every chase judge praised; and between the core and the
 *                  arms a floor of floor0 falling to floor1 from t0 to t1
 *                  s, so the young band is one mass and its lanes open as
 *                  it ages (seen from the side, a lane is a darker streak
 *                  along the band, as the reference's band has). 0 peak
 *                  off: the core alone.
 *   massAlpha      [th0, th1, film, opac0, opac1]: the alpha rises from 0
 *                  at thickness th0 to 1 at th1; the thin places keep a
 *                  film of `film` alpha (times the density's share), so a
 *                  boil is gray foam over dark water at its rim and the
 *                  water itself only at its heart; the reader's opacity
 *                  share rises from opac0 to opac1 of thickness (solid white
 *                  where the layer is thick).
 *   massLight      [relief, heightM, ao, gray, glow, bright, tone, bandH]: the layer's own light:
 *                  its normal from the heaps' slope, heightM meters of foam
 *                  per unit of thickness, lights its sun sides and shades
 *                  its flanks (relief 1 the full Lambert change); the thin
 *                  places and the creases fall to `ao` of the light; the
 *                  light grays to `gray` of itself over 4 s of age; `glow`
 *                  is the bubble glow's weight under the layer; `bright`
 *                  scales it all (the references' whitest foam is 205 to
 *                  225 sRGB, under the surface's clipped white); the light
 *                  near the veins' lines falls to `tone` of itself over a
 *                  wide soft band (the vein field under 0.7), soft gray
 *                  streaks along the flow such as the reference's band
 *                  has between its white ridges (1 off); the streaks are
 *                  thinner foam, so most of the tone goes to the alpha
 *                  (the water shows through, bluish) and 0.35 of it to the
 *                  light (as light alone, a gray foam read brown and dirty
 *                  over the opaque layer); `bandH` meters of height per
 *                  unit of the band's density across the trail add the
 *                  band's own slope to the relief, so the band is a raised
 *                  mass: its flank toward the sun lit, the other in shade
 *                  (0 off).
 *
 * Round 14's fields (a fresh builder after eight quarter losses; every
 * judge of rounds 6 to 13, in both views, named one fault: "hard-edged
 * white blotches punched with round holes of nearly one size", "leopard
 * spots", "Voronoi or Worley dots"). Measured on the judged crops
 * (`wake/r14/measure.py`): round 13's quarter crop has 119 holes, a median
 * of 12 px and a mean axis ratio of 2.4; the reference's has 27 holes, a
 * median of 43 px, a 90th to 10th percentile area ratio of 24 and a mean
 * axis ratio of 4.0 along the trail. The holes came from the lace (the
 * raft's popped cells, the net's windows) and from the layer's popped
 * bubbles (the same lace's rank), so this round replaces that STRUCTURE:
 * THE TRAIL (`wakeTrailImage`, oceanWakeTrail.ts), a ranked gradient-noise
 * field of many octaves, sheared along the flow by the propeller's jet,
 * drawn out along the flow, and eaten by the wake's own amount. When it is
 * on it draws every foam pixel of the wake, and the lace, the net and the
 * layer are not built. World space only: the trail's frame, its age and
 * its offset from the track.
 *   trail          [weight, tileM, stretch, fineTileM, fineShare, soft]: the
 *                  trail texture read at a tileM tile across the flow,
 *                  drawn out `stretch` times along it, with its second
 *                  field (G) read at a fineTileM tile turned TRAIL_TURN off
 *                  the axis and mixed into the rank by fineShare (the mix
 *                  made uniform again, wakeMixUniformCdf); the cover's ramp
 *                  is `soft` of rank either side of the threshold. 0 weight
 *                  off (no node, no texture, the lace as before).
 *   trailTexture   [gain, octaves, baseCells]: the structure field's octave
 *                  gain, its octave count and its first octave's cells a
 *                  tile (`wakeTrailImage`; build-time). A gain of 0.5 puts
 *                  most of the field in its first octave, and a cut of it
 *                  draws smooth blobs ("cottony blobs"); over 0.6 the small
 *                  octaves weigh as much, and the edges fray at every scale.
 *   trailFil       [share0, share1, a0, a1, fold]: THE THIN FOAM. Where
 *                  the trail's share falls from a1 to a0 the second field
 *                  enters the rank folded at its median (1 - |2 g - 1|:
 *                  uniform again, high along g's median contour, a network
 *                  of meandering lines of many sizes), its weight rising from
 *                  share0 to share1: the dense core keeps the first field's
 *                  holes, the thin edges and the old trail fray into
 *                  filaments along the flow, not blobs. `fold` is how much
 *                  of the second field is folded (1: the filaments; 0: the
 *                  field as it is, drawn out by trailFineStretch into
 *                  streaks). 0 share1 off (the second field unfolded at
 *                  trail[4]).
 *   trailShear     [dMaxM, tauS, widthM]: the jet's displacement aft, dMaxM
 *                  (1 - e^(-age / tauS)) e^(-(n / widthM)^2)
 *                  (`wakeTrailShearM`); the texture is read at the parcel's
 *                  birth position, so the foam is sheared along the flow at
 *                  the race's flanks and slides aft with it. 0 dMax off.
 *   trailLanes     [ampM, laneM, tauS, wanderM]: the race is not one jet but
 *                  lanes of faster and slower water side by side, so the
 *                  displacement also carries ampM (1 - e^(-age / tauS))
 *                  N((n + wanderM (slow - 0.5) 2) / laneM), N a smooth
 *                  profile across the trail (two sines), the lanes wandering
 *                  across with the lace's slow warp: young foam is isotropic
 *                  churn, old foam is drawn out along the flow, each lane
 *                  sheared its own way (a fixed stretch alone drew every
 *                  feature at one elongation: "brush strokes"). 0 amp off.
 *   trailFineStretch  how far the second field is drawn out along the flow
 *                  (the first field's is trail[2]): the fine bubble grain and
 *                  the edges' filaments are nearly round, so the fine scale
 *                  is not a motion blur.
 *   trailCover     [gain, cap, patchAmp]: the share of the field that is
 *                  foam, min(amount x gain, cap), times 1 + patchAmp
 *                  (patches - 0.5) with the lace's 97 m patches (a density
 *                  that varies over tens of meters, so the trail's holes do
 *                  not repeat with the tile).
 *   trailCore      [peak, r0, r1, fade, t0, t1, tauS]: the propeller's race keeps
 *                  the trail's middle dense: the share is at least peak
 *                  (1 - smoothstep(r0, r1, r)) with r the offset from the
 *                  track over the wake's edge (massBand's), falling to
 *                  `fade` of itself from t0 to t1 s of age, grown in over
 *                  the first 2 m behind the transom (the wake's own amount
 *                  alone thins there: sideThin, bandFade), and past t1 it
 *                  decays as e^(-(age - t1) / tauS), so the old trail thins
 *                  into lace and dissolves (0 tauS: it holds). 0 peak off.
 *   trailFilm      [a0, a1, film, depth]: in the holes of dense foam (a share
 *                  from a0 to a1) a film of up to `film` alpha: a thinned
 *                  place in the churn is gray-blue foam over the water, not
 *                  a cut to the dark sea; the holes of thin foam stay open
 *                  water. With `depth` over 0 the film thins to none by
 *                  `depth` of rank under the threshold: a small hole (a
 *                  shallow low of the field) is gray foam, a large one (a
 *                  deep low) opens to the water at its heart.
 *   trailGrain     [lo, tileM, foot0, foot1]: a bubble grain in the foam's
 *                  light, the second field at a tileM tile (round), from
 *                  `lo` to 1, where a pixel resolves it (a footprint under
 *                  foot0 to foot1 m); light only, never the cover. 1 lo off.
 *   trailOpac      [opThin, opRange, solid0, solid1]: inside the foam the
 *                  opacity rises from opThin at the threshold to 1 over
 *                  opRange of rank above it (thin edges see-through); the
 *                  reader's opacity share is the cover where the share
 *                  rises from solid0 to solid1 (dense young churn solid
 *                  white).
 *   trailLight     [rim, rimRange, heightM, sunGain, lo, hi, slopeGain, gray,
 *                  floor, bright]: the foam's light. Its rim (the threshold,
 *                  and thin foam) at 1 - rim, full by rimRange of rank over
 *                  it; its relief (the texture's slope, heightM meters a
 *                  unit) lit by its slope toward the sun, 1 - sunGain (slope
 *                  . sun) / sun.y clamped to lo and hi (a mean of 1:
 *                  round 13's finding); the wake's own slope, its Lambert
 *                  change by slopeGain; gray with age to `gray` of itself
 *                  over 0.5 to 4 s; never under `floor`; times `bright`.
 *   trailGlow      [gain, keep, r0, r1, holeClear]: the bubble glow under the
 *                  foam, gain x the share; the whole glow keeps `keep` of
 *                  itself past r1 of the wake's edge, all of it inside r0
 *                  (round 13's massGlow); the open holes of dense foam clear
 *                  holeClear of it.
 *
 * Round 15's fields (the round-14 verdicts: no judge named round holes any
 * more, and both named one gap: the foam does not change with AGE. The
 * quarter critic: "no dense core ... thin, sharp-edged white lace at one
 * flat brightness from end to end", "no fade with distance", "no milky
 * pale-turquoise bubble layer under and round the white; ours sits on the
 * water like paint"; the chase critic: "solid white blobs, shaded like
 * clouds ... cotton-wool clouds pasted on top of the sea", it should be "a
 * lacy foam network of white strands round dark holes, stretched along the
 * boat's line of travel, over lighter aerated water", "no fade", "the side
 * arms ... should be fewer, longer foam lines". Measured (`wake/r15/
 * measure.py`): round 14's white by age third 39/37/36% (quarter) and
 * 34/30/27% (chase, the reference's 47/49/16%); the water in the trail's
 * envelope 19 and 17 levels of luma over the open sea beside it at 0.14
 * and 0.11 less saturation, the references' 53 and 38 at 0.41 and 0.42
 * less: milky, not teal.) So the trail is graded by its age: the young
 * foam dense, bright and milky with dark holes over a whiter bubble glow;
 * the lace opens with age into a network of strands; then loose streaks
 * along the flow; then it is gone. World space: the age, the offset and
 * the amount.
 *   trailAge       [lace0, lace1, laceW, streak0, streak1, streakW]: the
 *                  second field's folded share (the network of strands,
 *                  trailFil) rises to laceW from lace0 to lace1 s of age
 *                  (the larger of it and trailFil's by the share), and the
 *                  streak read (trailStreak) takes streakW of the rank
 *                  from streak0 to streak1 s. 0 laceW and 0 streakW off.
 *   trailStreak    [stretch, tileM]: the streak read, the second field at
 *                  a tileM tile drawn out `stretch` times along the flow,
 *                  turned TRAIL_TURN2 the other way (its own lattice):
 *                  long loose streaks of many widths.
 *   trailArms      [weight, share]: the edge lines (the V arms, edgeLines)
 *                  take up to `weight` of their rank from the streak read,
 *                  by the line's own profile, so an arm is a few long
 *                  lines, not a scatter of lace bits ("like shader
 *                  sparkle"); and the share on the line is at least `share`
 *                  x its profile x its age fade, so the line is continuous
 *                  and the streak read breaks it only into long dashes. 0
 *                  weight and 0 share off.
 *   trailBump      [heightM, tileM, t0, t1]: a FINE relief on the young
 *                  foam: the texture's slope read at a tileM tile (lumps a
 *                  meter or so across, not the 4 m heaps round 14 lit as
 *                  "cotton-wool clouds"), heightM meters a unit, lit by its
 *                  slope toward the sun with a mean of 1, all of it to t0
 *                  s of age, none by t1: bumpy fresh churn. 0 height off.
 *   trailThin      [a0, a1, streakW]: thin foam is loose streaks, not
 *                  hairlines. The age lace's fold (trailAge) keeps only
 *                  smoothstep(a0, a1, share) of its weight (the folded
 *                  field at a thin share is its median contour alone: one
 *                  pixel wide wavy lines over the open water, "like shader
 *                  sparkle"), and the streak read takes up to streakW of
 *                  the rank where the share is under a0 to a1. 0 a1 off.
 *   trailOld       [opacity, t0, t1]: old foam goes translucent: its alpha
 *                  falls to `opacity` of itself from t0 to t1 s of age. 1
 *                  opacity off.
 *   trailMilk      [halo, reach, veil, t0, t1, light]: THE YOUNG MILKY VEIL.
 *                  Young foam (all of it to t0 s, none by t1) is wrapped in
 *                  a film of fine bubbles at the surface: up to `halo`
 *                  alpha within `reach` of rank under the threshold (round
 *                  the white and in its shallow holes) and a veil of `veil`
 *                  alpha over the trail's dense share, both in the gaps
 *                  only, lit at `light` of the white: churned water reads
 *                  milky, not teal. 0 halo and 0 veil off.
 *   trailYoung     [boost, t0, t1]: the young foam's light is 1 + boost of
 *                  itself to t0 s of age, falling to 1 by t1: bright fresh
 *                  churn against the older foam's gray (trailLight's gray).
 *                  0 boost off.
 *   trailMilkGlow  [gain, tauS, white]: the young bubble cloud: the glow
 *                  under the foam gains `gain` x the share x e^(-age /
 *                  tauS), and its color moves `white` of the way from the
 *                  milk to BUBBLE_WHITE (dense fine bubbles scatter every
 *                  color alike), by the same age weight. 0 gain and 0 white
 *                  off.
 *
 * Round 16's fields (the round-15 verdicts went backward at high confidence
 * in both views: its loose streaks and old foam drew "thousands of similar
 * crisp white flakes laid on ripple crests at one angle, like foam decals,
 * ice chips or sun glints", spread over the open sea, so the wake had no
 * edge; its milky young core read as "a soft white haze, like fog or light
 * shining up from under the water"). Round 16 builds on round 14's trail
 * (no judge has named round holes since) and keeps round 15's streaks,
 * flakes and milk off. Both views' judges of rounds 14 and 15 asked for
 * one thing: ONE CONNECTED FOAM SHEET in the wake's core, dense and nearly
 * solid near the boat, opaque, with ragged holes and clumps of mixed size;
 * holed lace toward its edges and farther back; long torn streaks at its
 * outer edge; a CLEAR EDGE, the foam gathered in the wake and none outside
 * it; the side arms as fewer, longer lines on the crests of the two
 * diverging waves. Measured first (`wake/r16/tools/measure16.py`, on the
 * re-matched quarter pose and the chase): the references' white is one
 * blob (99% and 81% of it in the largest), almost none of it outside the
 * trail's envelope (0% and 11%) and almost none in flakes under 40 px (0.1%
 * and 5.9%); round 14's 69% and 65%, 10% and 13%, 7.8% and 12.7%. World
 * space only: the offset from the track, the distance behind the transom,
 * the age, the wake's own height and the trail texture.
 *   trailBand      [peak, halfM, spread, softM, wobM, wobTileM]: THE SHEET.
 *                  The trail's share is at least `peak` inside a band of
 *                  half-width halfM + spread x d (d meters behind the
 *                  transom) across the track, falling to 0 over softM
 *                  either side of its edge; the edge moves by up to wobM
 *                  with the trail texture's second field read at a
 *                  wobTileM tile along the flow and 0.15 of it across
 *                  (ragged fingers along the flow, a few meters long), grown
 *                  in over the first meter behind the transom. A share this
 *                  high leaves only the field's deepest lows as holes, so
 *                  the white is one connected sheet. 0 peak off.
 *   trailBandAge   [t0, t1, floor, tauS]: the sheet thins as it ages: its
 *                  peak holds to t0 s, falls to `floor` of itself by t1 s,
 *                  then decays as e^(-(age - t1) / tauS) (0 tauS: it holds),
 *                  so the holes grow and merge into lace down the trail.
 *   trailHoles     [weight, tileM, stretch]: HOLES OF MIXED SIZE. Inside the
 *                  sheet the rank takes up to `weight` of a coarser read of
 *                  the structure field (a tileM tile across, drawn out
 *                  `stretch` times along the flow; the mix made uniform
 *                  again, wakeMixUniformCdf): the sheet's few holes follow
 *                  the coarse field's lows, a meter or two long, and their
 *                  edges stay ragged with the fine read's octaves. 0 weight
 *                  off.
 *   trailEdge      [keep, m0, m1]: THE CLEAR EDGE. Outside the sheet, from
 *                  m0 to m1 meters past its edge, the share the wake's own
 *                  amount gives (the churn, the breakers' deposit, the edge
 *                  lines) falls to `keep` of itself, so the thin foam the
 *                  wake's crests spill outside the trail does not dot the
 *                  open sea. 1 keep off.
 *   trailArmLine   [peak, spread, widthM, tauS, h0, h1, floor]: THE ARMS as
 *                  their own lines (with edgeLines' peak at 0): a line of
 *                  share `peak`, Gaussian of widthM across, from the
 *                  transom's corners out at `spread` meters a meter, fading
 *                  as e^(-age / tauS), and only on the wake's own crests:
 *                  full where the wake's height passes h0 to h1 meters,
 *                  `floor` of itself in its troughs, so an arm is a few
 *                  longer lines where the diverging waves' crests cross it.
 *                  0 peak off.
 *   trailCut       [a0, a1]: NO FLAKES. The share goes to 0 under a0 and is
 *                  itself over a1: a thin share leaves only the field's
 *                  highest peaks as foam, small isolated blobs of one size
 *                  (round 15's "flakes"). 0 a1 off.
 *   trailBandGlow  [gain, reachM]: the bubble glow under the sheet and just
 *                  round it: `gain` inside the band's edge, gone reachM past
 *                  it, by the sheet's age fade, so the pale glow is faint
 *                  and only where the churn is. 0 gain off.
 *   trailBody      [lo, range]: THE FOAM THINS TOWARD ITS HOLES. The foam's
 *                  light runs from `lo` at the threshold to 1 at `range` of
 *                  rank over it, so a dense sheet is not one flat white: the
 *                  foam round each hole and in the field's shallow lows is
 *                  thinner and grayer, its thick clumps white (light only,
 *                  never the cover). 1 lo off.
 *   trailCalm      [keep, reachM, d0, d1]: THE CALM LANE. The propeller's
 *                  turbulent race behind the transom breaks the wake's own
 *                  waves up where it runs: the stern wave's crest and the
 *                  transverse waves do not stand across the churned lane, and
 *                  the lane lies flat and matte (ship wakes show as a smooth
 *                  strip from the air, kilometers long). So inside the
 *                  sheet's half-width (trailBand's halfM + spread d, without
 *                  its wobble) the wake's own slope, in the shading, and its
 *                  lift, in the mesh, keep `keep` of themselves, all of it
 *                  back by reachM past the edge, grown in from d0 to d1 m
 *                  behind the transom (the water at the transom keeps the
 *                  hull's own rise). The sea's waves are not touched: the
 *                  sheet still rides and bends over the swell. Without it
 *                  the quarter view's band lay on the stern wave's lit face,
 *                  every quarter judge's "foam covering a wave face like a
 *                  whitecap" (`wake/r16/shots/dwave*`: the same look with the
 *                  wake's waves off reads as a trail). 1 keep off.
 *   trailSoft      [k]: THE SOFT EDGE. The structure reads (the first field,
 *                  the fine field and the coarse holes) take their mip from
 *                  k times the pixel's footprint, so the field is averaged
 *                  over k pixels' worth of the texture and a foam edge
 *                  softens over a few centimeters of the world; the finest
 *                  octaves, which drew one-pixel crisp flakes and hairlines,
 *                  go to their mean. Like any mip it changes how the same
 *                  texture samples, never where the foam is: a filtering
 *                  key. 1 off.
 *
 * Round 17's fields (the round-16 verdicts: both views LOST on the foam's
 * EDGE, GRAIN and OPACITY PROFILE; no judge named round holes, flakes, a wave
 * face or a steep diagonal any more. The quarter critic: "razor-sharp, binary
 * white edges at full opacity, like broken ice or peeling paint ... they
 * should be soft-edged foam with varying opacity: a thick, bright, lumpy core
 * that thins into semi-transparent lace and fine filaments at the margins",
 * "no bubbles under the surface", "no fade with distance", the thin streaks
 * "crisp drawn lines on top of the surface"; the chase critic: the center "a
 * flat, gray-white translucent wash with sharp, vector-like blob holes", no
 * fine bubble grain, patches of one size, the edge streaks "jagged, bright
 * splinters". Measured (`wake/r17/tools/measure17.py`): round 16's foam rises
 * from 0.2 to 0.8 of its white over 1.7 px at its edge, the references' over
 * 6.8 and 5.5 px; 12 px outside the edge the references' water is still 0.47
 * and 0.52 of the way to white (milky), round 16's 0.10 and 0.08.) World space
 * and filtering keys only.
 *   trailFringe    [reach, alpha, fine0, fine1, light, tileM]: THE GRADED
 *                  MARGIN. Under the cover's threshold, within `reach` of rank,
 *                  the foam keeps a translucent lace of up to `alpha`, fading
 *                  out with the distance under the threshold and cut into
 *                  filaments and speckle by the second field at a tileM tile
 *                  (its value from fine0 to fine1), lit at `light` of the
 *                  white: every edge, the sheet's and each hole's, thins
 *                  through lace into the water. Only where the trail has a
 *                  share (the cut's zero keeps it off the open sea). 0 alpha
 *                  off.
 *   trailArmSoft   [alpha, fineLo, light]: THE ARMS AS SOFT LINES: with alpha
 *                  over 0 the arm lines (trailArmLine) no longer enter the
 *                  share and its threshold (which cut them into bright jagged
 *                  splinters); they draw as a translucent line of up to
 *                  `alpha`, its opacity broken along it by the second field
 *                  (fineLo to 1) and lit at `light`: thin soft lines that
 *                  fade into the water. 0 alpha off.
 *   trailMilkWater [gain, reachM, white, tauS, weight]: THE MILKY WATER. Under
 *                  and round the sheet (within reachM past its edge) the
 *                  bubble cloud's light is 1 + gain of itself and `white` of
 *                  the way to BUBBLE_WHITE, and its weight at least `weight`,
 *                  all fading as e^(-age / tauS): the water between the foam
 *                  is a lighter, milky turquoise where air is mixed in. It is
 *                  the body's light under the fresnel, so the surface's
 *                  reflection and waves stay on top of it (not a veil over
 *                  them, round 15's fog). 0 gain and 0 weight off.
 *   trailClot      [amp, tileM, stretch]: STRUCTURE AT SEVERAL SCALES: the
 *                  sheet's share is 1 + amp (2 f - 1) of itself, f the
 *                  structure field read at a tileM tile drawn out `stretch`
 *                  times along the flow: dense clots and thinner stretches a
 *                  few meters long along the trail, under the field's own
 *                  holes of every size. 0 amp off.
 *   trailHalo      [blurM, soft, alpha, fineMix]: THE SOFT HALO. The
 *                  cover computed again from the structure field blurred over
 *                  blurM meters of the WORLD (its mip at least that coarse,
 *                  whatever the pixel), at the same threshold over `soft` of
 *                  rank, and drawn at `alpha` under the sharp cover, broken
 *                  by the fringe's second field by fineMix, lit as the fringe:
 *                  every foam edge ramps out over about blurM of the water
 *                  (the references' foam rises to its white over 5 to 7 px,
 *                  round 16's over 1.7), and holes smaller than blurM are
 *                  thinned foam. World space: the blur is a width on the
 *                  water, the same at every view (a pixel coarser than it
 *                  reads its own footprint, as any texture does). 0 alpha
 *                  off. (Built and off in r17: with it on, the viewer's
 *                  first compile of the surface shader took about 20 minutes
 *                  longer on this machine's D3D11 path.)
 *   trailBlur      [blurM]: THE WORLD BLUR. The structure reads (the first
 *                  field, the fine field, the coarse holes, the fringe's
 *                  field) resolve nothing finer than blurM meters of the
 *                  water: each read's gradient is at least blurM in its
 *                  tile's units, so the mip averages the finest octaves and
 *                  every edge, a hole's or the sheet's, ramps over about
 *                  blurM of the world at every view (round 16's edges rose
 *                  over one pixel whatever the distance: "razor-sharp, binary
 *                  white edges", "vector-like blob holes"). World space, like
 *                  trailHalo's blur. The blurred fields are narrower than
 *                  uniform, so a dense share keeps fewer holes (the smallest
 *                  thin into foam). 0 off.
 *   trailDots      [weight, tileM, stretch]: THE BUBBLE HOLES. Inside the
 *                  sheet the rank takes up to `weight` of the second field
 *                  read at a tileM tile across, drawn out `stretch` times
 *                  along the flow (the mix made uniform again), so the dense
 *                  core's holes are many small bubble holes of mixed size
 *                  among the coarse field's few large ones (the chase
 *                  reference: 137 holes with a median of 10 px; round 16's
 *                  core had 100 of 16 px, "patches all about one size, no
 *                  small flecks"). 0 weight off. (Built and off in r17: with
 *                  it on the viewer was ready in 550 s against 115 s, the
 *                  surface shader's first compile on the D3D11 path; the
 *                  fine read at a 1 m tile gives the small holes instead.)
 */
export interface WakeLook {
  readonly laceWeights: readonly [number, number, number, number];
  readonly holeStretch: number;
  readonly streakStretch: number;
  readonly subGain: number;
  readonly corePocketLo: number;
  readonly corePocketRamp: readonly [number, number];
  readonly pocketsGlow: boolean;
  readonly coreGrain: boolean;
  readonly foamVolume: boolean;
  readonly backfaceCap: number;
  readonly backfaceKnee: number;
  readonly jacGatherMax: number;
  readonly ageShade: readonly [number, number, number, number];
  readonly ageOpacity: readonly [number, number, number];
  readonly wispAge: readonly [number, number];
  readonly laceSharp: number;
  readonly coreSharp: number;
  readonly wispStretch: number;
  readonly wispRange: readonly [number, number];
  readonly streakJitter: number;
  readonly edgeStreaks: number;
  readonly sideKey: readonly [number, number];
  readonly sideStretch: readonly [number, number];
  readonly clumpTear: readonly [number, number, number];
  readonly clumpTearAge: readonly [number, number];
  readonly clumpTearTile: number;
  readonly clumpTearAmt: readonly [number, number];
  readonly fleckKeep: number;
  readonly sideSharp: number;
  readonly pinholes: readonly [number, number];
  readonly darkRim: readonly [number, number];
  readonly crestPile: readonly [number, number];
  readonly sideFade: readonly [number, number, number];
  readonly laceFold: readonly [number, number, number];
  readonly haze: readonly [number, number, number, number, number];
  readonly glintSlick: readonly [number, number, number];
  readonly edgeLines: readonly [number, number, number, number];
  readonly envelope: readonly [number, number, number, number];
  readonly laceNet: readonly [number, number, number, number, number];
  readonly backSlope: readonly [number, number, number];
  readonly coreBand: readonly [number, number, number, number];
  readonly netSoft: number;
  readonly aerate: readonly [number, number, number, number];
  readonly coreBoil: readonly [number, number, number, number, number];
  readonly churnSlope: readonly [number, number, number];
  readonly netFine: readonly [number, number];
  readonly sideNet: readonly [number, number];
  readonly clumpShade: readonly [number, number, number];
  readonly sideThin: readonly [number, number, number, number, number];
  readonly bandFade: readonly [number, number, number];
  readonly coreSolid: readonly [number, number, number, number, number, number, number, number, number, number, number];
  readonly ridgeTear: number;
  readonly crestOut: number;
  readonly coreOpacity: readonly [number, number, number];
  readonly coreTear: readonly [number, number, number, number];
  readonly coreLace: readonly [number, number];
  readonly debugView: number;
  readonly mass: readonly [number, number, number, number, number, number];
  readonly massBand: readonly [number, number, number, number, number, number];
  readonly massAge: readonly [number, number, number, number, number, number];
  readonly massBoil: readonly [number, number, number, number, number];
  readonly massVeins: readonly [number, number, number, number, number, number];
  readonly massPores: readonly [number, number, number, number, number, number];
  readonly massLace: readonly [number, number, number, number, number, number];
  readonly massWisp: readonly [number, number, number];
  readonly massCrest: readonly [number, number, number];
  readonly massSlope: readonly [number, number];
  readonly massGlow: readonly [number, number, number, number];
  readonly massSun: readonly [number, number, number];
  readonly massGrain: readonly [number, number, number, number, number, number];
  readonly massArms: readonly [number, number, number, number, number, number, number, number];
  readonly massAlpha: readonly [number, number, number, number, number];
  readonly massLight: readonly [number, number, number, number, number, number, number, number];
  readonly trail: readonly [number, number, number, number, number, number];
  readonly trailTexture: readonly [number, number, number];
  readonly trailFil: readonly [number, number, number, number, number];
  readonly trailShear: readonly [number, number, number];
  readonly trailLanes: readonly [number, number, number, number];
  readonly trailFineStretch: number;
  readonly trailCover: readonly [number, number, number];
  readonly trailCore: readonly [number, number, number, number, number, number, number];
  readonly trailFilm: readonly [number, number, number, number];
  readonly trailGrain: readonly [number, number, number, number];
  readonly trailOpac: readonly [number, number, number, number];
  readonly trailLight: readonly [number, number, number, number, number, number, number, number, number, number];
  readonly trailGlow: readonly [number, number, number, number, number];
  readonly trailAge: readonly [number, number, number, number, number, number];
  readonly trailStreak: readonly [number, number];
  readonly trailArms: readonly [number, number];
  readonly trailBump: readonly [number, number, number, number];
  readonly trailOld: readonly [number, number, number];
  readonly trailThin: readonly [number, number, number];
  readonly trailMilk: readonly [number, number, number, number, number, number];
  readonly trailYoung: readonly [number, number, number];
  readonly trailMilkGlow: readonly [number, number, number];
  readonly trailBand: readonly [number, number, number, number, number, number];
  readonly trailBandAge: readonly [number, number, number, number];
  readonly trailHoles: readonly [number, number, number];
  readonly trailEdge: readonly [number, number, number];
  readonly trailArmLine: readonly [number, number, number, number, number, number, number];
  readonly trailCut: readonly [number, number];
  readonly trailBandGlow: readonly [number, number];
  readonly trailBody: readonly [number, number];
  readonly trailCalm: readonly [number, number, number, number];
  readonly trailSoft: readonly [number];
  readonly trailFringe: readonly [number, number, number, number, number, number];
  readonly trailArmSoft: readonly [number, number, number];
  readonly trailMilkWater: readonly [number, number, number, number, number];
  readonly trailClot: readonly [number, number, number];
  readonly trailHalo: readonly [number, number, number, number];
  readonly trailBlur: readonly [number];
  readonly trailDots: readonly [number, number, number];
}

/**
 * Round 17's fields at their off values: the read as it was before them
 * (round 16 node for node).
 */
const WAKE_LOOK_ROUND17_OFF = {
  trailFringe: [0.15, 0, 0.4, 0.75, 0.85, 1.2] as const,
  trailArmSoft: [0, 0.4, 0.9] as const,
  trailMilkWater: [0, 2, 0, 3, 0] as const,
  trailClot: [0, 14, 2] as const,
  trailHalo: [0.25, 0.08, 0, 0.5] as const,
  trailBlur: [0] as const,
  trailDots: [0, 0.8, 1.5] as const,
};

/**
 * Round 16's fields at their off values: the read as it was before them
 * (round 15 node for node).
 */
const WAKE_LOOK_ROUND16_OFF = {
  trailBand: [0, 3.5, 0, 1, 0, 30] as const,
  trailBandAge: [2, 4, 1, 0] as const,
  trailHoles: [0, 9, 1.6] as const,
  trailEdge: [1, 0.5, 2] as const,
  trailArmLine: [0, 0.18, 0.8, 4, 0.1, 0.3, 1] as const,
  trailCut: [0, 0] as const,
  trailBandGlow: [0, 2] as const,
  trailBody: [1, 0.5] as const,
  trailCalm: [1, 3, 2, 8] as const,
  trailSoft: [1] as const,
};

/**
 * Round 15's fields at their off values: the read as it was before them
 * (round 14 node for node).
 */
const WAKE_LOOK_ROUND15_OFF = {
  trailAge: [1, 2.5, 0, 3, 5, 0] as const,
  trailStreak: [4, 2.5] as const,
  trailArms: [0, 0] as const,
  trailBump: [0, 1.2, 1, 3] as const,
  trailOld: [1, 2, 4] as const,
  trailThin: [0, 0, 0] as const,
  trailMilk: [0, 0.15, 0, 1.5, 3, 0.7] as const,
  trailYoung: [0, 1, 3] as const,
  trailMilkGlow: [0, 2, 0] as const,
};

/**
 * Round 14's fields at their off values: the read as it was before them.
 * trail[0] gates the whole path (0: no node, no texture, the lace and the
 * layer as before); the others are its sub-paths' neutral values.
 */
const WAKE_LOOK_ROUND14_OFF = {
  trail: [0, 3.6, 2.4, 1.4, 0.35, 0.07] as const,
  trailTexture: [0.55, 5, 4] as const,
  trailFil: [0, 0, 0.3, 0.7, 1] as const,
  trailShear: [0, 2, 2.5] as const,
  trailLanes: [0, 1.2, 2, 2] as const,
  trailFineStretch: 1,
  trailCover: [1, 0.93, 0] as const,
  trailCore: [0, 0.3, 0.62, 0.5, 0.5, 4.2, 0] as const,
  trailFilm: [0.6, 1, 0, 0] as const,
  trailGrain: [1, 0.45, 0.03, 0.08] as const,
  trailOpac: [0.4, 0.3, 2, 3] as const,
  trailLight: [0, 0.15, 0, 0, 0.75, 1.15, 0, 1, 0, 1] as const,
  trailGlow: [0, 1, 0.45, 0.8, 0] as const,
};

/**
 * Round 12's fields at their off values: the read as it was before them.
 * mass[0] gates the whole path (0: no node, no texture); inside it each
 * sub-path is off here too (the veins' w1, the pores' rank1, the lace
 * cut's share, the wisps' gain, the crest's cut, the arms' peak, the
 * band's wisp and bandH all 0; the tone 1; round 13's slope, sun and grain
 * gains 0, the glow's keep 1 and its hole clear 0), so a spec that turns
 * the mass on starts from the layer alone.
 */
const WAKE_LOOK_ROUND12_OFF = {
  mass: [0, 10, 3.7, 1.4, 0.35, 0.2] as const,
  massBand: [0.1, 0.6, 1.15, 1.1, 1.6, 0] as const,
  massAge: [1.1, 0.5, 0.5, 4.5, 4, 7] as const,
  massBoil: [0.14, 0.1, 0.9, 0.08, 0.35] as const,
  massVeins: [0, 0, 0, 0.04, 1, 0] as const,
  massPores: [0, 0, 0.1, 0.03, 0.3, 1.7] as const,
  massLace: [0, 0.95, 0.82, 0.08, 0.04, 0.3] as const,
  massWisp: [0, 0.3, 0.9] as const,
  massCrest: [0, 0.3, 0.55] as const,
  massSlope: [0, 0] as const,
  massGlow: [1, 0.5, 1, 0] as const,
  massSun: [0, 0.8, 1.15] as const,
  massGrain: [0, 0.1, 0.7, 1, 1.1, 0] as const,
  massArms: [0, 0.82, 0.14, 5, 1, 0.35, 0.6, 2.5] as const,
  massAlpha: [0.3, 0.62, 0.22, 0.7, 1.1] as const,
  massLight: [1, 0.3, 0.72, 0.8, 0.3, 0.88, 1, 0] as const,
};

/** Round 6's fields at their off values: the read as it was before them. */
const WAKE_LOOK_ROUND6_OFF = {
  laceFold: [0, 0, 0] as const,
  haze: [0, 0.3, 0.85, 0, 0.25] as const,
  glintSlick: [0, 0.05, 0.4] as const,
  edgeLines: [0, 0.1, 1, 4] as const,
  envelope: [0.1, 1, 4, 1] as const,
  laceNet: [0, 0, 0, 1.6, 1] as const,
  backSlope: [0, 0.12, 0.3] as const,
  coreBand: [0.5, 1.1, 0, 1] as const,
  netSoft: 0,
  aerate: [0, 0.6, 0, 0] as const,
  coreBoil: [0, 6, 1, 1, 0.28] as const,
  churnSlope: [0, 6, 4] as const,
  netFine: [0, 0] as const,
  sideNet: [0, 0] as const,
  clumpShade: [0, 0.3, 0] as const,
  sideThin: [0.5, 1, 1, 0.5, 2] as const,
  bandFade: [1, 4, 1] as const,
  coreSolid: [0, 7, 0.25, 0.04, 0.15, 0.93, 0, 0, 0.8, 0, 0] as const,
  ridgeTear: 0,
  crestOut: 1,
  coreOpacity: [0, 0, 0.93] as const,
  coreTear: [0, 2.5, 0, 0.8] as const,
  coreLace: [0, 0.04] as const,
  debugView: 0,
};

/** Round 5's fields at their off values: the read as it was before them. */
const WAKE_LOOK_ROUND5_OFF = {
  sideKey: [0.85, 1.25] as const,
  sideStretch: [0, 0] as const,
  clumpTear: [0.4, 0.5, 0] as const,
  clumpTearAge: [0, 0] as const,
  clumpTearTile: 0,
  clumpTearAmt: [0, 0] as const,
  fleckKeep: 1,
  sideSharp: 0,
  pinholes: [0, 1.1] as const,
  darkRim: [0, 0.3] as const,
  crestPile: [0, 0.4] as const,
  sideFade: [0, 0, 1] as const,
};

/** Round 4's fields at their off values: the read as it was before them. */
const WAKE_LOOK_ROUND4_OFF = {
  backfaceKnee: 0,
  jacGatherMax: 1.8,
  ageShade: [0, 0, 1, 1] as const,
  ageOpacity: [0, 0, 1] as const,
  wispAge: [-1, -1] as const,
  laceSharp: 0,
  coreSharp: 0,
  wispStretch: 0,
  wispRange: [0, 0] as const,
  streakJitter: 0,
  edgeStreaks: 0,
};

/** Round 2's read: the build that won the chase view (2026-09-24). */
export const WAKE_LOOK_ROUND2: WakeLook = {
  laceWeights: WAKE_LACE_WEIGHTS,
  holeStretch: 1.8,
  streakStretch: 3,
  subGain: 0.75,
  corePocketLo: 0.25,
  corePocketRamp: [0.12, 0.42],
  pocketsGlow: true,
  coreGrain: false,
  foamVolume: false,
  backfaceCap: 0,
  ...WAKE_LOOK_ROUND4_OFF,
  ...WAKE_LOOK_ROUND5_OFF,
  ...WAKE_LOOK_ROUND6_OFF,
  ...WAKE_LOOK_ROUND12_OFF,
  ...WAKE_LOOK_ROUND14_OFF,
  ...WAKE_LOOK_ROUND15_OFF,
  ...WAKE_LOOK_ROUND16_OFF,
  ...WAKE_LOOK_ROUND17_OFF,
};

/** Round 3's read: lost both views (2026-09-24); kept so it can be shown. */
export const WAKE_LOOK_ROUND3: WakeLook = {
  laceWeights: [0.5, 0.26, 0.1, 0.14],
  holeStretch: 1.3,
  streakStretch: 2,
  subGain: 0.55,
  corePocketLo: 0.08,
  corePocketRamp: [0.1, 0.3],
  pocketsGlow: false,
  coreGrain: true,
  foamVolume: true,
  backfaceCap: 0.7,
  ...WAKE_LOOK_ROUND4_OFF,
  ...WAKE_LOOK_ROUND5_OFF,
  ...WAKE_LOOK_ROUND6_OFF,
  ...WAKE_LOOK_ROUND12_OFF,
  ...WAKE_LOOK_ROUND14_OFF,
  ...WAKE_LOOK_ROUND15_OFF,
  ...WAKE_LOOK_ROUND16_OFF,
  ...WAKE_LOOK_ROUND17_OFF,
};

/**
 * Round 4's read: round 2's, plus the back-face cap with a knee and the
 * quarter view's fade, film and wisps keyed on the trail's age from 3.5 s
 * (21 m behind the transom at the trawler's speed), past the chase view's
 * judged crop. Chosen from the round-4 sweeps (`wake/r4/sheet-s3.png`):
 * the knee at 0.3 leaves the chase crop at 125 pixels (0.08%) and removes
 * the stair-stepped back-face patch; at 0.2 it moved 2.3% of the crop for
 * a sliver more. The age fields leave the chase crop at 0 pixels.
 */
export const WAKE_LOOK_ROUND4: WakeLook = {
  ...WAKE_LOOK_ROUND2,
  backfaceCap: 0.9,
  backfaceKnee: 0.3,
  ageShade: [3.5, 7, 0.65, 1],
  ageOpacity: [3.5, 7, 0.4],
  wispStretch: 6,
  wispAge: [3, 6],
};

/**
 * Round 5's read (values of round 5b): round 2's, the back-face cap with
 * its knee, the trail's structure at every view (the mat torn into clumps
 * at its edges and tail that thin with age into flecks, sharp borders,
 * pinholes, a dark rim, foam piled on the wake's crests, a thinning tail)
 * and the on-screen stretch bounded. Round 4's age fields (the film and
 * the wisps) are off: the round-4 quarter critic read them as "a
 * continuous smeared veil with one uniform brush direction". Values from
 * the round-5 sweeps (`wake/r4/sheet-t1.png` to `-t3.png`, one path at a
 * time, then together) and the round-5b retune at every view
 * (`sheet-u1.png`, candidate 1): the tear at a 12 m tile gated by the
 * amount keeps the band's middle a whole mat and breaks its edges and
 * tail into islets of 1 to 3 m; the tear and the tail start at 2 s, past
 * the chase crop's young lanes, so that view keeps its dense core that
 * splits into lanes, widens and frays; the rim at 0.6 replaces the
 * submerged glow the round-2 chase judges named "a milky gray film".
 */
export const WAKE_LOOK_ROUND5: WakeLook = {
  ...WAKE_LOOK_ROUND2,
  backfaceCap: 0.9,
  backfaceKnee: 0.3,
  sideKey: [0.85, 1.25],
  sideStretch: [0.6, 1],
  clumpTear: [0.45, 0.55, 0.9],
  clumpTearAge: [2, 6],
  clumpTearTile: 12,
  clumpTearAmt: [0.3, 0.7],
  fleckKeep: 0.85,
  sideSharp: 0.7,
  pinholes: [0.5, 1.1],
  darkRim: [0.6, 0.3],
  crestPile: [0.5, 0.4],
  sideFade: [2, 8, 0.5],
};

/**
 * Round 6's read: round 5b's, and the trail's one structure from the
 * stern to the tail, every key in world space (the trail's age, its
 * offset from the track, the wake's own amounts and slope). A bright
 * opaque core behind the transom (the raft's read, as before) opens from
 * 1 to 3 s into the net lace (walls round windows of many sizes, drawn
 * out 1.6 times along the flow, its tiles at 0.7 of WAKE_NET_TILE_M) and
 * turns to a film as it ages (opacity to 0.75 from 2.5 to 6 s, the amount
 * to 0.6 from 2 to 8 s); the turbulent wake has an edge that widens at
 * 0.1 m a meter from the transom's corners, with two lines of white
 * along it, and the thin foam the wake's crests spill outside it keeps a
 * quarter of itself; the stern wave's back slope opens into lace behind a
 * lip; a soft haze at every foam edge in place of round 5's dark rim;
 * the glints dead across the lane. Round 5's pinholes are off (the
 * "dalmatian spatter"), and the submerged glow is at 0.2 (0.75 x 0.4,
 * about what round 5's rim let through, less a little: with the haze on,
 * the lane read milky). Values from the round-6 sweeps
 * (`wake/r6/sheet-s1.png` to `-s8.png`, both crops per candidate).
 */
export const WAKE_LOOK_ROUND6: WakeLook = {
  ...WAKE_LOOK_ROUND5,
  subGain: 0.2,
  pinholes: [0, 1.1],
  darkRim: [0, 0.3],
  sideFade: [2, 8, 0.6],
  ageOpacity: [2.5, 6, 0.75],
  laceNet: [1, 3, 1, 1.6, 0.7],
  haze: [0.15, 0.25, 0.85, 0, 0.25],
  glintSlick: [1, 0.05, 0.4],
  edgeLines: [0.5, 0.1, 0.8, 5],
  envelope: [0.1, 0.5, 3, 0.25],
  backSlope: [0.5, 0.12, 0.3],
};

/**
 * Round 7's read: round 6's, with the trail's core band. Round 6 won the
 * chase view in both orders and lost the quarter view in both: from low
 * and to the side the net's thin walls over the stern wave's broad face
 * read as "an even net of thin, crisp, bright-white strands with no dense
 * core anywhere". Both views show foam of the same ages (0 to 3.6 s), so
 * the answer is in world space: the middle of the trail, within 0.6 of
 * the churn's width of the track and fading out by 1.6, ages 1.2 s later
 * for the structure (it opens into the net from 2.2 s, not 1 s) and keeps
 * 0.3 of the back slope's cut and of a trough's drain, so it stays one
 * dense bubbly band while the edges break into lace; the net's walls get
 * a soft ramp of 0.28 of rank and a coarser tile (0.9 of WAKE_NET_TILE_M),
 * so they are thick, see-through at their flanks and not wiry (the chase
 * critic's "marble veins"); the churned water glows a milky turquoise
 * under and around the foam (aerate 0.35, milk 0.6; subGain 0.45); the
 * haze follows only an amount over 0.12 (round 6's drew the net's faint
 * outlines over the open water); the edge lines are fainter (0.3, over
 * 4 s) so the trail reads as one fan, not three prongs; the amount thins
 * sooner outside the band (to 0.4 from 1 to 4.5 s) and the crests' thin
 * foam past the trail's edge keeps 0.12 of itself, so the old edges are
 * sparse. Values from the round-7 sweeps (`wake/r7/sheet-s1.png` to
 * `-s6.png`, both crops per candidate).
 */
export const WAKE_LOOK_ROUND7: WakeLook = {
  ...WAKE_LOOK_ROUND6,
  coreBand: [0.6, 1.6, 1.2, 0.3],
  netSoft: 0.28,
  aerate: [0.35, 0.6, 0.6, 0],
  subGain: 0.45,
  haze: [0.15, 0.25, 0.85, 0.12, 0.4],
  laceNet: [1, 3, 1, 1.6, 0.9],
  edgeLines: [0.3, 0.1, 0.9, 4],
  sideFade: [1, 4.5, 0.4],
  envelope: [0.1, 0.5, 3, 0.12],
};

/**
 * Round 8's read: round 7's, with the core's dark boils, clumps and
 * bubble grain (coreBoil: boils where the raft at a 6 m tile, drawn out
 * twice along the flow, is under 0.35 of its rank, clearing 0.85 of the
 * alpha and the glow; the foam's light from 0.65 to 1 over the clumps
 * and from 0.75 to 1 over a 1.1 m grain), the lane's own turbulent lumps
 * (churnSlope: up to about 0.2 of slope from the clumps channel at a 6 m
 * tile, fading over 4 s of the trail's age, through the back-face cap),
 * the glow keyed on the shaped amount (aerate[3]: the gaps between the
 * trail's arms are clearer water), the fine net drawn out 3 times along
 * the flow at 0.9 of its tile (netFine), round 5's on-screen stretch
 * bound OFF (sideStretch [0, 0]: it made the holes round on screen at the
 * quarter view, the round-7 critics' "isotropic speckle", and it was the
 * read's last view-keyed path; with it off no look keys on the camera),
 * and the back-face cap at 0.6 over a knee of 0.25 (with the lace moved,
 * more of the stern wave's far face showed flat gray back-face patches).
 * Values from the round-8 sweeps (`wake/r8/sheet-s1.png` to `-s3.png`,
 * `-g3.png`).
 */
export const WAKE_LOOK_ROUND8: WakeLook = {
  ...WAKE_LOOK_ROUND7,
  aerate: [0.35, 0.6, 0.6, 1],
  netFine: [3, 0.9],
  sideStretch: [0, 0],
  coreBoil: [0.85, 6, 0.65, 0.75, 0.35],
  churnSlope: [0.2, 6, 4],
  backfaceCap: 0.6,
  backfaceKnee: 0.25,
};

/**
 * Round 9's read: round 8's, reshaped for the quarter view, which rounds 6
 * to 8 lost ("a uniform, one-direction smear of white strokes, like a
 * motion-blurred texture"). The core band (0.7 of the churn's width from
 * the track, out to 1.6) keeps the raft's clumped lace with its dark
 * holes for 4 s more (coreBand delay 4: the net opens only at the band's
 * sides and far behind) and fades to 0.55 of itself from 1.5 to 4 s of
 * its true age (bandFade); between 0.5 and 1 of the churn's width the
 * amount falls to half from 0.5 to 2 s (sideThin), so the core stands out
 * from sparse sides; the two edge lines are firmer (0.6, 1.3 m across,
 * over 5 s), the V arms of the chase view; the foam has body (clumpShade:
 * its rim at 0.75 of its light, white by 0.3 of rank over the threshold,
 * down-sun flanks up to 0.2 darker). And round 5's filtering-like key is
 * back at gentler values, with the net under it too: seen across the
 * flow the raft's holes, the streaks and the coarse and fine net are read
 * at stretches of 1, 1.5, 1 and 1.3 (sideStretch, sideNet; round 5 used
 * 0.6 and 1 on the raft alone, and round 7's critics read "round cells";
 * round 8 had it off, the strokes). Seen along the flow (the chase view)
 * the key is 0, so that view's texture is round 8's; the orbit proof
 * (`wake/r5b/orbit.mjs` with the key bypassed) holds the amount. Values
 * from the round-9 sweeps (`wake/r9/qsheet-*.png`, `csheet-*.png`).
 */
export const WAKE_LOOK_ROUND9: WakeLook = {
  ...WAKE_LOOK_ROUND8,
  sideStretch: [1, 1.5],
  sideNet: [1, 1.3],
  clumpShade: [0.25, 0.3, 0.2],
  coreBand: [0.7, 1.6, 4, 0.3],
  sideThin: [0.5, 1, 0.5, 0.5, 2],
  edgeLines: [0.6, 0.1, 1.3, 5],
  bandFade: [1.5, 4, 0.55],
};

/**
 * Round 10's read: round 9's, with the core band's young foam one
 * near-solid churned mass (coreSolid: cover 0.93 within 0.3 to 0.7 of the
 * churn's width of the track where the amount is over 0.3 to 0.75, torn by
 * voids where the clumps channel at a 5 m tile, drawn out twice along the
 * flow, is under 0.25, the threshold rising by up to 0.25 with age and
 * toward the band's edge; its light from 0.6 to 1 over its heaps and at
 * its voids' rims, 0.25 of it a bubble mottle; round 8's boils cut it
 * too, the chase view's dark churned trough), the stern wave's lip torn
 * by the same field (ridgeTear 0.06), the crest pile outside the band at
 * 0.3 of its gain (crestOut), the sides thinner (sideThin floor 0.3), the
 * crests' thin foam past the trail's edge at 0.05 (envelope), the band's
 * fade to 0.45 from 1 to 3.5 s, and the edge lines at 0.45 over 1.1 m and
 * 4 s. The quarter crop's coverage (pixels over 150 sRGB) is 31% against
 * round 9's 43%, round 5b's 31% and the reference's 24%. Values from the
 * round-10 sweeps (`wake/r10/qsheet-s1.png` to `-s8.png`, `csheet-*`).
 */
export const WAKE_LOOK_ROUND10: WakeLook = {
  ...WAKE_LOOK_ROUND9,
  coreSolid: [1, 5, 0.25, 0.05, 0.25, 0.93, 0.3, 0.7, 0.6, 0.25, 1],
  ridgeTear: 0.06,
  crestOut: 0.3,
  sideThin: [0.5, 1, 0.3, 0.5, 2],
  envelope: [0.1, 0.5, 3, 0.05],
  bandFade: [1, 3.5, 0.45],
  edgeLines: [0.45, 0.1, 1.1, 4],
};

/**
 * Round 11's read: round 10's, with the young core opaque and its mass a
 * dense lace. coreOpacity [0, 3, 1]: the solid band's alpha rises to 1
 * and its weight goes to the surface as the new `opacity` share (the foam
 * cap from 0.85 to 1), both falling over 3 s of the trail's age;
 * coreLace [0.85, 0.04]: inside the mass the lace's own rank is cut at a
 * cover of 0.85 over a sharp ramp, so from above it is crisp clumps with
 * small dark holes and from the side it foreshortens to a dense band;
 * coreTear [0.4, 2.5, 0.12, 1]: the voids from a two-octave tear (a
 * second read at 2 m), each ringed by lace over 0.12 of the field, and
 * clearing the whole glow; the voids' rims 0.06 of the field soft and
 * their light down to 0.55 (coreSolid); the foam no longer laid out along
 * the swell: the sea's folding gathers it at most 1.2 times (was 1.8),
 * the crest pile 0.25 (was 0.5), the back slope's cut 0.3 (was 0.5); and
 * round 9's firmer edge lines back (0.6, 1.3 m, 5 s), the V arms both
 * round-9 chase judges praised. Values from the round-11 sweeps
 * (`wake/r11/qsheet-s1.png` to `-s3.png`, `csheet-*`).
 */
export const WAKE_LOOK_ROUND11: WakeLook = {
  ...WAKE_LOOK_ROUND10,
  coreOpacity: [0, 3, 1],
  coreTear: [0.4, 2.5, 0.12, 1],
  coreLace: [0.85, 0.04],
  coreSolid: [1, 5, 0.25, 0.06, 0.25, 0.93, 0.3, 0.7, 0.55, 0.25, 1],
  jacGatherMax: 1.2,
  crestPile: [0.25, 0.4],
  backSlope: [0.3, 0.12, 0.3],
  edgeLines: [0.6, 0.1, 1.3, 5],
};

/**
 * Round 12's read: round 11's, with the trail's CORE a layer of foam
 * (`mass`, `wakeMassImage`) in place of the lace: a dense band along the
 * track, full to 0.3 of the wake's edge and none of its density by 0.62
 * (1 to 2.5 m each side), its edge moved by up to 0.45 of it with the
 * vein field so it breaks into wisps along the flow; density 1.25 falling
 * to 0.7 of it from 0.5 to 6 s; the thickness varied by 0.85 and 0.5 about
 * that at a 10 m and a 3.7 m tile (the second turned 35 degrees), drawn
 * out 1.3 times along the flow; boils where the thickness field is in its
 * lowest 12% (19% on the track), thinning the layer by 0.8 of its
 * density; a few popped bubbles (the lace's rank cut at a cover of 0.95
 * falling to 0.85 by 4 s and 0.06 less at the edge, a soft ramp of 0.1,
 * 0.25 of the alpha kept); the layer thinner on the wake's own crests
 * (0.6 of the noise from 0.3 to 0.55 m: a ragged crest line); the alpha
 * from 0 at a thickness of 0.38 to 1 at 0.62, a film of 0.22 in the thin
 * places; its light from its relief (0.3 m a unit of the blurred
 * thickness, and 0.8 m a unit of the band's own profile: a raised mass),
 * 0.88 in its thin places, gray to 0.82 by 4 s, soft streaks to 0.75
 * (mostly in the alpha), 0.9 of the white. Round 11's lace keeps the
 * band's sides and the arms, which are thinner: the sides to 0.25 of
 * their amount (was 0.3), the edge lines 0.5 over 1.2 m and 4.5 s (were
 * 0.6, 1.3 m, 5 s). The mass hands over to the lace from 5 to 8 s of age,
 * past both judged crops. Values from the round-12 sweeps
 * (`wake/r12/qsheet-s1.png` to `-s23.png`, `csheet-*`).
 */
export const WAKE_LOOK_ROUND12: WakeLook = {
  ...WAKE_LOOK_ROUND11,
  mass: [1, 10, 3.7, 1.3, 0.85, 0.5],
  massBand: [0.1, 0.3, 0.62, 0.55, 0.9, 0.45],
  massAge: [1.25, 0.7, 0.5, 6, 5, 8],
  massBoil: [0.12, 0.12, 0.8, 0.07, 0.4],
  massLace: [1, 0.95, 0.85, 0.06, 0.1, 0.25],
  massCrest: [0.6, 0.3, 0.55],
  massAlpha: [0.38, 0.62, 0.22, 0.7, 1.05],
  massLight: [1, 0.3, 0.88, 0.82, 0.3, 0.9, 0.75, 0.8],
  sideThin: [0.5, 1, 0.25, 0.5, 2],
  edgeLines: [0.5, 0.1, 1.2, 4.5],
};

/**
 * Round 13's read: round 12's layer made OPAQUE and lit as foam, not a
 * translucent film. The round-12 critics (both orders at the quarter view,
 * one at the chase view) read the band's shape as the nearest yet and its
 * tone as wrong: "a flat, translucent gray-white smear", "gray smudged
 * streaks ... like a dirty painted decal", "teal bleeding into the white";
 * at the chase view "soft, smeared and milky ... a milky white veil lies
 * over the whole wake band, the gaps between the core and the arms
 * included". So: the alpha goes from 0 at a thickness of 0.45 to 1 at 0.55
 * with no film, and the opacity share is full from 0.7 (massAlpha); the
 * soft tonal streaks are off (massLight's tone 1) and the band's edge
 * moves only 0.12 of it with the veins (massBand); the light is the slope
 * toward the sun alone (massSun 1.2, 0.75 to 1.2: a mean of 1, where round
 * 12's cosine had a mean of about 0.87), times the wake's own slope
 * (massSlope 0.6), times the raft channel (massGrain: 0.65 in its gaps and
 * cells, 1 over 0.7 of it, and a bubble speckle to 0.75 at a 1.1 m tile
 * where a pixel resolves it), a lip of 0.35 less light round each popped
 * bubble, 0.65 in the layer's thin places, never under 0.45; more popped
 * bubbles (the lace's rank cut at 0.84 falling to 0.66 by 4 s), with a
 * film of 0.1, and each clears half the glow, so it is darker water; the
 * bubble glow keeps 0.35 of itself past 0.8 of the wake's edge, all of it
 * inside 0.45 (massGlow), so the water between the core and the arms is
 * clear and dark; the density falls to 0.5 of itself by 4.2 s (massAge).
 * Round 11's arms are back (edgeLines 0.6 over 1.3 m and 5 s, sideThin
 * 0.3), the arms both round-11 chase judges praised. Values from the
 * round-13 sweeps (`wake/r13/qsheet-s1.png` to `-s11.png`, `csheet-*`).
 */
export const WAKE_LOOK_ROUND13: WakeLook = {
  ...WAKE_LOOK_ROUND12,
  massAlpha: [0.45, 0.55, 0, 0.5, 0.7],
  massBand: [0.1, 0.3, 0.62, 0.55, 0.9, 0.12],
  massAge: [1.25, 0.5, 0.5, 4.2, 5, 8],
  massSun: [1.2, 0.75, 1.2],
  massSlope: [0.6, 0.45],
  massLight: [0, 0.3, 0.65, 0.88, 0.3, 1, 1, 0.5],
  massGrain: [0.35, 0.2, 0.7, 0.75, 1.1, 0.35],
  massLace: [1, 0.84, 0.66, 0.06, 0.04, 0.1],
  massGlow: [0.35, 0.45, 0.8, 0.5],
  edgeLines: [0.6, 0.1, 1.3, 5],
  sideThin: [0.5, 1, 0.3, 0.5, 2],
};

/**
 * Round 14's read: round 13's amount (the churn, the deposit, the edge
 * lines and their fades) drawn by THE TRAIL in place of the lace, the net
 * and the layer (see round 14's fields). The texture's field is rough
 * (gain 0.62, six octaves from 5 cells a tile: at 0.5 a cut drew smooth
 * "cotton" blobs, sweep s5), read at a 4 m tile drawn out 1.6 times along
 * the flow (6 m made the median hole smaller than the reference's in
 * pixels, 3 m drew a finer, puffier lace, sweeps s3, s18); its second field
 * at a 1.4 m tile drawn out 1.8 times, folded into filaments with a weight
 * of 0.6 where the share is under 0.25 and 0.2 over 0.75 (the thin edges
 * fray into lace, the core keeps a few small holes; the unfolded field at
 * 4 times drew diamond "flames", sweep s7). The jet shears it little (0.5
 * m over 5 m: at 1.5 m over 2.5 m the flanks drew a symmetric herringbone,
 * s14, s15), and lanes of 1 m wander across it. The share is 0.6 of the
 * amount, at least a race of 1.3 full to 0.28 of the wake's edge and gone
 * by 0.58, falling to 0.45 of itself from 0.5 to 3.8 s and as e^(-t / 5 s)
 * after (without the tail it held 0.84 for the whole 200 m of the view
 * from above, a white road; with 0.6 by 4.2 s it held one density across
 * the chase crop, which the reference's thins in its oldest third, s21),
 * the edge widening
 * 0.11 m a meter behind the transom (massBand[0]: the band spreads behind
 * the boat), capped at 0.88 so the densest churn keeps its deepest lows as
 * holes; the edge lines 1.2 over 0.8 m, out at 0.18 m a meter and fading
 * over 4 s (the V arms, which spread and thin). The foam is opaque past
 * 0.12 of rank over the threshold (at 0.3 the wide translucent fringe drew
 * every patch as a puff of cloud, s18, s19); the holes of dense foam keep
 * a film of 0.6 that is gone 0.18 of rank under the threshold (small holes
 * are gray-blue, large ones open); its light is 0.66 of the white (on
 * ACES's shoulder a brighter foam is flat white: the band's tone is 177,
 * 189, 198 sRGB at its 10th, 50th and 90th percentiles against the
 * quarter reference's 167, 184, 200), its thin rims 0.12 darker, a faint
 * relief (0.04 m a unit), the wake's own slope, a bubble grain to 0.88
 * at a 0.3 m tile where a pixel resolves it; the bubble glow 0.15 of the
 * share, kept under the core. Measured on the judged crops
 * (`wake/r14/measure.py`, the pixels whose smallest channel is over 150):
 * the quarter crop's hole-area spread (90th over 10th percentile) 17.9
 * against the reference's 24.1, the holes' mean axis ratio 3.57 against
 * 3.95, 7 degrees off the trail; the chase crop's 14.9 against 11.7 and
 * 2.12 against 2.09; white 21.8% and 21.1% of the crops against 20.2% and
 * 14.9%. Values from the round-14 sweeps (`wake/r14/shots/`, s1 to s21).
 */
export const WAKE_LOOK_ROUND14: WakeLook = {
  ...WAKE_LOOK_ROUND13,
  massBand: [0.11, 0.3, 0.62, 0.55, 0.9, 0.12],
  edgeLines: [1.2, 0.18, 0.8, 4],
  trail: [1, 4, 1.6, 1.4, 0.3, 0.06],
  trailTexture: [0.62, 6, 5],
  trailFil: [0.2, 0.6, 0.25, 0.75, 1],
  trailShear: [0.5, 2, 5],
  trailLanes: [1, 1.2, 2, 2],
  trailFineStretch: 1.8,
  trailCover: [0.6, 0.88, 0.3],
  trailCore: [1.3, 0.28, 0.58, 0.45, 0.5, 3.8, 5],
  trailFilm: [0.6, 1, 0.6, 0.18],
  trailGrain: [0.88, 0.3, 0.03, 0.08],
  trailOpac: [0.5, 0.12, 0.7, 0.95],
  trailLight: [0.12, 0.15, 0.04, 1, 0.7, 1.2, 0.6, 0.88, 0.45, 0.66],
  trailGlow: [0.15, 0.35, 0.45, 0.8, 0.3],
};

/**
 * Round 15's read: round 14's trail graded by its AGE (see round 15's
 * fields). The race's core keeps its share (1.3) to 1.8 s and falls to
 * 0.12 of it by 3.2 s, then as e^(-t / 1.5 s) (round 14: 0.45 by 3.8 s),
 * so the chase crop's white by age third is 38, 33 and 21% (the
 * reference's 47, 49 and 16%; round 14's 34, 30 and 27%). The young foam
 * (to 1.2 s) is 1.5 times as bright falling to 1 by 3 s, over a whiter,
 * denser bubble glow (trailMilkGlow 1.6, over 3 s) and wrapped in a milky
 * film in its gaps (trailMilk: 0.45 round the white, 0.45 over the dense
 * share, gone from 2 to 4 s), and it has no relief of its own (round 14's
 * 0.04 m heaps were the chase judge's "cotton-wool clouds"; a fine relief
 * at 0.8 to 1.2 m, trailBump, drew a regular ripple and is off). From 1.2
 * to 2.6 s the lace opens: the second field folded at its median takes 0.7
 * of the rank (a network of strands round dark holes), read at 2.6 m (was
 * 1.4 m: at 1.4 m the network was a hairline mesh), but only where the
 * share is over 0.15 to 0.4 (at a thin share the fold is one-pixel wavy
 * lines over the open water, trailThin); from 1.8 to 3.2 s the streak read
 * takes 0.7 of it (long loose streaks along the flow), as does all thin
 * foam (0.8 under a share of 0.15 to 0.4); old foam goes translucent (0.65
 * from 2 to 3.4 s) and gray (0.75); the arms (the edge lines) are lines of
 * their own share, 0.8 of their profile, broken by the streak read into
 * long dashes (trailArms). The light is 0.62 of the white, its rims 0.12
 * darker over 0.2 of rank; the glow 0.3 of the share, 0.2 clearer in the
 * open holes. Values from the round-15 sweeps (`wake/r15/shots/s1` to
 * `s9`); measured in the round-15 bullet of the domain doc.
 */
export const WAKE_LOOK_ROUND15: WakeLook = {
  ...WAKE_LOOK_ROUND14,
  trail: [1, 4, 1.6, 2.6, 0.3, 0.06],
  trailCore: [1.3, 0.28, 0.58, 0.12, 1.8, 3.2, 1.5],
  trailLight: [0.12, 0.2, 0, 1, 0.7, 1.2, 0.6, 0.75, 0.45, 0.62],
  trailGlow: [0.3, 0.35, 0.45, 0.8, 0.2],
  trailAge: [1.2, 2.6, 0.7, 1.8, 3.2, 0.7],
  trailStreak: [4, 2.5],
  trailArms: [0.8, 0.8],
  trailBump: [0, 0.8, 1, 3],
  trailOld: [0.65, 2, 3.4],
  trailThin: [0.15, 0.4, 0.8],
  trailMilk: [0.45, 0.2, 0.45, 2, 4, 0.72],
  trailYoung: [0.5, 1.2, 3],
  trailMilkGlow: [1.6, 3, 1],
};

/**
 * Round 16's read: round 14's trail (round 15's streaks, flakes, milk and
 * old-foam film off) drawn as ONE CONNECTED SHEET down the trail's core with
 * a CLEAR EDGE (see round 16's fields). The sheet: a share of 0.95 inside
 * 3.2 m of the track, widening 0.04 m a meter, its edge soft over 0.9 m and
 * moved 1.5 m by the second field read at a 20 m tile along the flow
 * (fingers along the flow); it holds to 1.8 s and falls to 0.4 of itself by
 * 3.6 s, then as e^(-t / 2 s), so the holes open into lace toward the tail
 * (both judged crops hold foam 0 to 3.5 s old). Its holes: 0.45 of the rank
 * from the structure field at a 9 m tile (few holes, a meter or two long,
 * ragged at their edges). Round 15's age lace kept at half weight: the
 * second field folded at its median takes 0.5 of the rank from 0.8 to 2.4 s
 * of age, read at 1.8 m (a cellular sheet from above, the chase judges'
 * "connected cellular foam sheet"; with it off the crops keep half their
 * holes, `final/ablation16.png`). Round 14's race core is off (the sheet
 * replaces it) and the amount's share is 0.4 of it (was 0.6). The clear
 * edge: the amount's edge lines are off and no share under 0.15 to 0.35
 * draws (no flakes; with the cut off the white outside the quarter crop's
 * envelope rises from 4.1% to 5.4%). trailEdge and round 15's trailThin are
 * built and off: in the ablation neither moved either crop's measures, since
 * the cut already takes the thin share both act on. The arms:
 * lines of 0.75 at 0.7 m across from the transom's corners out at 0.18 m a
 * meter, fading over 4 s, full on the wake's crests (0.05 to 0.25 m) and a
 * quarter in its troughs (the amount's edge lines off). The calm lane: the
 * wake's own slope and lift keep 0.3 of themselves inside the sheet, all of
 * it 8 m past it, grown in 1 to 5 m behind the transom. The structure reads
 * take their mip from twice the footprint (soft edges, no one-pixel flakes).
 * The light: 0.6 of the white, 0.6 at the threshold rising to 1 over half
 * the rank above it (the foam thins toward its holes); opaque from 0.35 at
 * the threshold over 0.2 of rank, the soft ramp 0.1 of rank; the glow 0.25
 * under the sheet and gone 2.5 m past it, the open holes 0.6 clearer. Values
 * from the round-16 sweeps (`wake/r16/shots/s1` to `s11`, `tmp/sh-s*.png`);
 * measured in the round-16 bullet of the domain doc.
 */
export const WAKE_LOOK_ROUND16: WakeLook = {
  ...WAKE_LOOK_ROUND14,
  edgeLines: [0, 0.18, 0.8, 4],
  trail: [1, 4, 1.6, 1.8, 0.3, 0.1],
  trailCore: [0, 0.28, 0.58, 0.45, 0.5, 3.8, 5],
  trailCover: [0.4, 0.88, 0.3],
  trailOpac: [0.35, 0.2, 0.7, 0.95],
  trailFilm: [0.6, 1, 0.5, 0.25],
  trailFil: [0.1, 0.6, 0.25, 0.75, 1],
  trailLight: [0.12, 0.15, 0, 1, 0.7, 1.2, 0.6, 0.88, 0.45, 0.6],
  trailGlow: [0.15, 0.35, 0.45, 0.8, 0.6],
  trailAge: [0.8, 2.4, 0.5, 3, 5, 0],
  trailBand: [0.95, 3.2, 0.04, 0.9, 1.5, 20],
  trailBandAge: [1.8, 3.6, 0.4, 2],
  trailHoles: [0.45, 9, 1.6],
  trailArmLine: [0.75, 0.18, 0.7, 4, 0.05, 0.25, 0.25],
  trailCut: [0.15, 0.35],
  trailBandGlow: [0.25, 2.5],
  trailBody: [0.6, 0.5],
  trailCalm: [0.3, 8, 1, 5],
  trailSoft: [2],
};

/**
 * Round 17's read: round 16's sheet with a GRADED MARGIN, fine bubble holes,
 * soft arms and milky water (see round 17's fields). The margin: under the
 * threshold a translucent lace of up to 0.55 within 0.2 of rank, cut into
 * filaments by the second field at a 1.2 m tile (trailFringe); the cover's
 * ramp 0.2 of rank either side of the threshold (was 0.1), the foam opaque
 * from 0.3 at it over 0.4 of rank above it (trailOpac), the small holes'
 * film 0.15 (was 0.5: at 0.5 the core read as "a flat, gray-white
 * translucent wash"). The fine structure: the second field read at 1 m (was
 * 1.8 m) with 0.4 of the rank (was 0.3), so the dense core is holed by many
 * small bubble holes (136 holes with a median of 9 px in the chase crop, the
 * reference's 137 and 10; round 16 102 and 16), under 0.35 of the coarse
 * field's large holes and the clots (trailClot, 0.25 at 14 m); the foam's
 * light 0.45 at the threshold rising to 1 over 0.6 of rank (trailBody: the
 * foam thins toward its holes), a bubble grain to 0.8 at a 0.25 m tile where
 * a pixel resolves it (a footprint under 0.06 to 0.16 m). The sheet 3.4 m
 * across the track (was 3.2), fading faster: held to 1.6 s, 0.3 of itself by
 * 3.4 s, old foam to 0.7 of its alpha from 2.2 to 3.6 s (both crops' oldest
 * third falls to 23 to 28% white, the chase reference's to 16%). The milky
 * water: under and within 3 m of the sheet the bubble light is 3 times
 * itself and 0.7 of the way to BUBBLE_WHITE, its weight at least 0.7, over
 * 3 s of age (the water in the trail +31 and +22 levels of luma over the sea
 * beside it; round 16's +14 and +15; the references' +53 and +38). The arms:
 * soft translucent lines of up to 0.45, 0.35 m across, broken along their
 * length by the second field (trailArmSoft; round 16's crisp lines were
 * "jagged, bright splinters"). trailHalo, trailBlur and trailDots are built
 * and off: the halo and the dots each made the surface shader's first
 * compile 4 to 20 minutes longer on this machine's D3D11 path (the viewer
 * ready in 550 s with the dots against 115 s without), and the world blur
 * drew smooth round holes. Values from the round-17 sweeps
 * (`wake/r17/shots/t1` to `t8`); measured in the round-17 bullet of the
 * domain doc.
 */
export const WAKE_LOOK_ROUND17: WakeLook = {
  ...WAKE_LOOK_ROUND16,
  trail: [1, 4, 1.6, 1.0, 0.4, 0.2],
  trailFilm: [0.6, 1, 0.15, 0.25],
  trailOpac: [0.3, 0.4, 0.7, 0.95],
  trailBody: [0.45, 0.6],
  trailBand: [0.95, 3.4, 0.04, 0.9, 1.5, 20],
  trailHoles: [0.35, 9, 1.6],
  trailArmLine: [0.75, 0.18, 0.35, 4, 0.05, 0.25, 0.25],
  trailFringe: [0.2, 0.55, 0.35, 0.75, 0.85, 1.2],
  trailArmSoft: [0.45, 0.1, 0.9],
  trailMilkWater: [2, 3, 0.7, 3, 0.7],
  trailClot: [0.25, 14, 2],
  trailGrain: [0.8, 0.25, 0.06, 0.16],
  trailBandAge: [1.6, 3.4, 0.3, 2],
  trailOld: [0.7, 2.2, 3.6],
};

/**
 * The look the wake ships with: ROUND 11's (wake round 18, 2026-09-28).
 *
 * What changed: the default moves from round 17's look back to round 11's.
 * Why: round 11's look WON both judged views in both side orders against
 * the bars of that day: the quarter view against a LIVE capture of Three.js
 * Water Pro's demo at our side camera (`quarter-m`; the reference
 * `.agent/scratch/ocean-gauntlet/wake/ref/side/quarter-live.png`, crop 1043
 * 513 557 357 scaled to 610 x 391, ours 990 431 610 391), and the chase view
 * against the demo's boat mode (`wake/ref/boat-w-23.png`), where it had won
 * in both orders in round 12 too. The later looks lost there: round 17
 * split the live quarter view (its band read as "a glossy gray sheen, like
 * sky glare, not matte foam") and lost the chase view; rounds 12 to 16 lost
 * the views they were judged on. What stays: every preset (`r2` to `r17`)
 * and every field, so a later round starts from round 11 and can still
 * show any build through `&wakelook=`.
 */
export const WAKE_LOOK_DEFAULT: WakeLook = WAKE_LOOK_ROUND11;

/** The named looks a spec may start from. */
export const WAKE_LOOK_PRESETS: Readonly<Record<string, WakeLook>> = {
  r2: WAKE_LOOK_ROUND2,
  r3: WAKE_LOOK_ROUND3,
  r4: WAKE_LOOK_ROUND4,
  r5: WAKE_LOOK_ROUND5,
  r6: WAKE_LOOK_ROUND6,
  r7: WAKE_LOOK_ROUND7,
  r8: WAKE_LOOK_ROUND8,
  r9: WAKE_LOOK_ROUND9,
  r10: WAKE_LOOK_ROUND10,
  r11: WAKE_LOOK_ROUND11,
  r12: WAKE_LOOK_ROUND12,
  r13: WAKE_LOOK_ROUND13,
  r14: WAKE_LOOK_ROUND14,
  r15: WAKE_LOOK_ROUND15,
  r16: WAKE_LOOK_ROUND16,
  r17: WAKE_LOOK_ROUND17,
};

/**
 * A look spec, as a capture rig writes it in a URL: comma-separated
 * tokens, each a preset name (`r2` to `r17`) or `field:value`, applied in
 * order over the default. A value is a number, `0`/`1` for a boolean
 * field, or numbers joined by `/` for a list field. An empty spec is the
 * default. An unknown field or preset throws: a misspelled control that
 * fell back silently would make a sweep lie.
 */
export function parseWakeLook(spec: string): WakeLook {
  let look: WakeLook = { ...WAKE_LOOK_DEFAULT };
  const tokens = spec.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  for (const tok of tokens) {
    const colon = tok.indexOf(':');
    if (colon < 0) {
      const preset = WAKE_LOOK_PRESETS[tok];
      if (!preset) throw new Error(`[ocean] No wake look preset "${tok}". Presets: ${Object.keys(WAKE_LOOK_PRESETS).join(', ')}.`);
      look = { ...preset };
      continue;
    }
    const key = tok.slice(0, colon) as keyof WakeLook;
    const raw = tok.slice(colon + 1);
    if (!(key in WAKE_LOOK_DEFAULT)) {
      throw new Error(`[ocean] No wake look field "${key}". Fields: ${Object.keys(WAKE_LOOK_DEFAULT).join(', ')}.`);
    }
    const nums = raw.split('/').map((v) => Number(v));
    if (nums.some((v) => !Number.isFinite(v))) throw new Error(`[ocean] Wake look field "${key}": "${raw}" is not a number.`);
    const cur = WAKE_LOOK_DEFAULT[key];
    let value: unknown;
    if (typeof cur === 'boolean') value = nums[0] !== 0;
    else if (typeof cur === 'number') value = nums[0];
    else {
      if (nums.length !== (cur as readonly number[]).length) {
        throw new Error(`[ocean] Wake look field "${key}" takes ${(cur as readonly number[]).length} numbers, got ${nums.length}.`);
      }
      value = nums;
    }
    look = { ...look, [key]: value };
  }
  return look;
}
