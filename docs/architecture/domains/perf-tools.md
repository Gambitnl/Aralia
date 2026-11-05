# Performance tools (fps and frame time)

Verified: 2026-11-01 for the page meter (pageFrameProbe.ts, 21 focused tests). Verified: 2026-10-21. Fixed-grid projection cache is wired into production; three focused tests and three-file scoped types pass. Current-view 30 FPS acceptance FAILED: candidates remain below target or have frequent slow frames, and dependency-header HMR accidentally reset the live simulation epoch. No render-cache candidate is promoted.

## Town meshlet experiment

### Current town comparison

Verified: 2026-11-04. The measured comparison is complete and the current candidate is rejected for production. Actual street ABBA means are 49.95 FPS for Standard and 45.24 for Meshlet. Revisited hall means are 43.65 and 32.12 FPS, respectively. All eight repaired windows keep identical feet/camera within each view, real Meshlet counters, no captured errors and no visibility changes. Separate physically matched r172/r187 Standard controls exist for both street (36.20/43.37) and stationary hall (50.19/47.39), one window per version in different views from the ABBA samples. These shared-host observations and visible material/shadow differences do not qualify an upgrade or a GPU-only gain.

The final source-qualified full reload preserves 137 of 139 groups exactly; only game clock and live banter diagnostics differ. Manual payload, all meaningful journey groups, source identity and feet remain exact. Production stays on r172; original save and immutable source are preserved. Experiment error/frame/receipt guards are bounded and the existing camera spatial query is reused, but host input deadline overruns are still unresolved in WF-G373. Resolve that root behavior and qualify material/shadow/camera parity before any future promotion. The complete town goal remains paused and unaccepted. The dated stages below retain their original next actions as history, not current instructions.

### Recovered hall milestone (November 4)

Verified: 2026-11-04. The actual r187 hall comparison now executes both pipelines. Street comparison and complete full-reload continuity remain in progress. No production renderer or dependency change is promoted.

The public native helper initialized with a 30-second startup allowance after two short inventory timeouts. Warm native inventory returned in 845 ms and CUA inventory in 6.33 seconds. A disposable page then verified a click in 330 ms, a deliberately missing selector's 1-second deadline in 1.35 seconds, an immediate recovery click in 273 ms, and individual right press/move/release in 83/51/62 ms. No desktop setting was changed and no alternate browser was used. This is observed recovery, not a patch to the installed controller or a proven cold-start cause. A later 25-scroll batch reached its 15-second outer limit; the same town was recovered without reload in 10.8 seconds. Smaller input operations remain mandatory, and an action that times out must be inspected before retrying because its click may have taken effect.

The isolated diagnostic overlay had two concrete unbounded failure paths: retaining every error forever and waiting forever for animation frames. It now retains 64 deduplicated error examples with total/sequence counts, limits recording arrays, cancels frame/timer handles at a 30-second recording deadline, and bounds receipt requests. Recordings with errors, hidden views, stopped frames, or no actual meshlet cluster coverage are invalid. Seven focused probes pass, including 100,000 repeated errors, distinct-error eviction, post-marker error detection, normal completion, missing frames and a main-thread stall crossing the deadline. These guards do not establish the original crash cause.

Before resuming, all seven current isolated slots were exported through a read-only visible control. The latest native Auto-Save at 16:25:09 was resumed normally; the earlier background run had advanced its clock. No morning rollback, original-origin input or save replacement occurred. All 11,088 files in the accepted application snapshot match their manifest. Original native export, fixture and source-manifest hashes remain exact. The primary Three dependency remains r172; unrelated shared Playwright changes are preserved.

The official MeshletDrawingPipeline is now actually selected and GPU readback first reports 414 clusters/26,496 triangles in the actual town. A short ordinary W step stops at real bedding. At the reached feet, native To Player obtains an interior camera. The rendered hall contains beds, a barrel, furniture, Nell and nearby residents. The subsequent four matched 20-second samples retain identical camera and feet at x470.49786039588196, z490.1028048186424, y4.722837280319517. Standard records 8.41 and 8.84 FPS; Meshlet records 8.04 and 7.26 FPS with 129-130 clusters and 8,256-8,320 padded triangles. All four windows have no captured errors or visibility transitions; p95 frame intervals are about 216.6 ms. The order is Standard, Meshlet, Meshlet, Standard, with five seconds of warm-up each. The hall is slow in both, with no observed meshlet benefit. These are shared-host page frame intervals; they are not a general GPU performance claim. Live schedules and lighting remain active, so NPC pose/count changes and elapsed clock time are recorded rather than suppressed.

Both displayed hall results and retained raw canvas captures were inspected. The canvas export appears brighter than the composited in-app view, so raw-image color equality is not a claim about displayed color parity. Existing grain, room lighting and navigation friction remain visible and unqualified.

Next: walk through the existing door to a real street, run the same reverse-order comparison, revisit the furnished hall and verify normal save/full document reload against meaningful saved groups. Preserve source, occupancy, privacy, doors, collision, lighting and quality. The earlier incomplete attempt below remains historical evidence.

Receipts: ignored meshlet-town-ab/receipts/controller-recovery-nov04.json, bounded-diagnostics-checks-nov04.json, source-tree-verification-nov04.json, preserved-native-slots-1793817671476.json, and 187-standard/meshlet-nov04-hall recordings ending 7466 through 7469. Agora agora-da70 remains in progress; GF-G118 and WF-G373 are not closed by this milestone.

### Camera CPU diagnosis and reused repair

An actual 40.393-second JavaScript profile contains 23,192 samples. Building camera-clearance queries account for 28,257.935 ms of 40,392.562 ms sampled time (69.96%). The hot stack runs from getVertexPosition/checkGeometryIntersection through native recursive building raycasts, playerCameraVisibility and cameraBeforeBuilding into the real FreeRoamCameraController frame callback. This identifies an application CPU bottleneck; it does not establish the cause of the historical multi-hour controller timeout.

Current production already uses nearestGroundCameraHit for building and deck surfaces. The isolated experiment now stages that existing helper and replaces only source08's structural query branch. Source08 body samples, camera acceptance policy, rendered geometry, door transforms, schedules and saved identity remain unchanged. The helper retains native custom/animated-raycast fallbacks. Both pipelines receive the same change. The current focused camera query/visibility suites pass 28 tests. This is supporting evidence; actual input, rendered replay, comparison and full-reload continuity still require qualification.

Seven current isolated native slots were exported again before the owned 3046 server restarted. Normal Save Game completed first; no fixture was reimported and no original game origin was operated. Receipts: camera-query-staging-nov04.json and preserved-native-slots-1793820004167.json under ignored meshlet-town-ab/receipts. The earlier hall is house 1, Cottage #0; The Gilded Homestead label describes a nearby workshop, not the occupied room.

### Repaired street replay

After the staged existing camera query is adopted through a full document reload, an actual 19.777-second profile records 11,487 samples. Camera visibility accounts for 3,249.958 ms of 19,776.504 ms sampled time (16.43%). Native buttons and keyboard movement respond. The profiler includes walking at a different doorway position, so this is supporting CPU evidence rather than a matched FPS gain. One later orbit-release command still times out within its bounded call although the rotation applies; explicit release and current-view inspection recover it. The historical host-controller defect is not closed.

The normal rotated cottage route is physically traversable. Beds, the door frame and the inward leaf initially block incorrect approaches. The door guard refuses opening from its swing corridor. Moving inside, following the frontage, standing clear and awaiting the actual Close door acknowledgement permits the outward crossing. Nell then walks onto the real street. No feet, camera pose, scene or saved outcome is injected.

At identical reached street feet and camera in all four windows, repaired r187 Standard records 51.40 and 48.51 FPS; Meshlet records 45.03 and 45.45 FPS, with 163 clusters and 10,432 padded triangles. All four 20-second windows are valid, have stable camera/feet, no captured errors, no visibility transitions and p95 intervals about 33.4 ms. Order is Standard, Meshlet, Meshlet, Standard, each with five seconds of warm-up. The arithmetic means are 49.95 versus 45.24 FPS, about 9.4% lower with Meshlet in this view. These remain shared-host observations with live schedules and lighting. They do not support enabling Meshlet in production. Both displayed pipelines retain the dark road and existing architectural/lighting defects; those defects are not repaired by pipeline selection.

The first full loaded-state audit compares all 139 saved groups after ordinary Save, full document reload and Continue. 135 groups match exactly, including party, temporary party, inventory, gold, NPC memories, townSim, companions, quests, discoveries, source identity, feet and worldforgeDeltas. Differences are gameTime (+36 seconds), saveTimestamp, live banter diagnostics and one post-save Game Saved! message appended after serialization. No group is missing. This does not yet replace the final end-of-comparison save/reload check.

Receipts: camera-query-native-replay-nov04.json; continuity-audit-187-nov04-door-diagnosis-1793820626842.json; and repaired-street recordings ending 6844 through 6847. Next: check the installed r172 renderer separately at a normally restored street camera, revisit the hall for repaired matched pipeline windows, then verify the final native save/full reload. Keep the production dependency and unrelated source unchanged.

### Installed-version street control and remaining timeout

A separate normal Save/full reload/Continue runs the preserved street with the installed r172 WebGPURenderer. Native To Player restores the same physical camera as r187's separate version-control view. Saved feet match exactly; subtracting each rendered player's floating-origin position gives identical eye and target offsets, with zero maximum difference. The single 20-second r172 window records 36.20 FPS/p95 50 ms versus r187 Standard 43.37 FPS/p95 33.4 ms in that separate view. Both windows have no captured errors or visibility changes. This is one shared-host window per version, not the street ABBA view or an upgrade performance qualification.

Displayed inspection and retained canvas images reveal a material regression: the r172 street has readable stone paving, while the same r187 view has a nearly black road and stronger speckled building shading. Both r187 pipelines share this failure. The dependency upgrade is therefore not visually qualified, regardless of the one-window timing difference. Production remains on r172.

The r172 return walk then produces delayed input/inspection: a 1,200 ms held key plus AX read takes 22.885 seconds despite a 10-second outer timeout; screenshot capture fails once; To Player takes 14.510 seconds/10-second outer; later short-key calls take 18.814 and 23.694 seconds despite 15-second bounds. The tab remains inventoried and recovers rendering without a reload, with no captured console errors. A 35.396-second profile includes 5.391 seconds idle and no recurrence of the original 70% native-triangle hot stack. The root host-controller timeout remains unproved and open. These intervals supply no FPS or successful interior-baseline claim. The current seven native slots are preserved, and normal Save/full reload returns the same reached journey to r187 for the remaining hall comparison.

Receipts: version-control-street-summary.json; 172-standard-nov04-version-control-street-1793821368428.json/png; 187-standard-nov04-version-control-street-1793820626848.json/png; preserved-native-slots-1793821863813.json. No fixture reimport, original-origin operation, production renderer upgrade or unrelated source edit occurred.

### Final measured comparison and source-qualified reload

The actual return reaches the same cottage hall through its open entrance, with beds, barrel, walls, partition and door leaf still mounted. Repaired r187 hall ABBA records Standard 43.99/43.30 FPS (mean 43.65) and Meshlet 30.26/33.97 FPS (mean 32.12, 26.4% lower). All four windows have identical camera and feet before/after and across runs, real 158 clusters/10,112 padded triangles under Meshlet, no captured errors and no visibility transitions. P95 intervals are 33.4 ms for Standard and 66.8/50.1 ms for Meshlet. One Standard window includes a 1,000 ms frame and one Meshlet window an 1,800 ms frame; both remain in the results. Together with the four repaired street windows, these eight valid shared-host samples show no reason to enable Meshlet. They do not isolate GPU-only cost.

Displayed and raw-canvas inspection also shows the door's inset panels change appearance when switching pipelines, independently of the r187-versus-r172 black-road regression. No material, shadow or camera parity claim is made. The walking camera still obscures the player from some interior angles; its old source08 body-sampling policy is preserved rather than silently replaced with newer peer work. Actual Meshlet examination of a reached hall bed opens the normal card: sleeping requires the owner's permission and private beds are not spare lodging. No rest, item taking, NPC conversation or forced outcome occurs. Standard is restored before the final save.

Normal Save and full document reload are followed by an export of all seven native slots at the title, after storage recovery and before Continue. This pins the actual recovered autosave, SHA-256 d1468d9f5d3953caf01fb2121ac3ef0e386bc22931d1807d7338241e24d78fe1, saved time 0351-01-01T17:37:36.000Z. It avoids misidentifying a pre-unload ordinary autosave as the loaded source: ordinary autosaving serializes counter+1 without dispatch, whereas beforeunload writes the live state into the newer emergency snapshot, which startup recovers. The earlier 135/139 checkpoint comparisons remain limited historical observations, not exact raw-load-source identities.

The source-qualified final runtime has all 139 groups, with 137 exact and none missing. Only gameTime and live banterDebugLog differ. Dice counter is exactly 28 on both sides. Party, temporary party, inventory, gold, NPC memory, townSim, companions, quests, discoveries, world identity, worldforgeDeltas, door state and exact feet x471.9516282513807/z489.4441995052988/y4.722837280319517 are unchanged. The manual native payload stays byte-exact, SHA-256 b9cfa18cb3946e63ffa68564c34ffff891ab071c26a53cc2f3721e3ee7563075. No fixture is imported and the original game origin remains unoperated.

Preservation recheck hashes all 11,088 immutable source files with zero differences. Original export, fixture and source manifest retain their recorded hashes. Production Three remains declared ^0.172.0 and installed 0.172.0. Shared package/lock hashes differ from the initial experiment because of retained peer Playwright work, not this renderer lane. Seven bounded-diagnostic probes and 28 existing camera checks pass. Temporary receipts, JSON, full native exports and the inspected comparison figure remain ignored. Source or renderer promotion is rejected; the historical host crash cause and reproduced deadline overruns remain open in WF-G373. The narrower comparison is measured; the full towns goal is not complete and unrelated paused gameplay is not resumed.

Receipts: final-comparison-summary.json; source-qualified-continuity-summary.json; preserved-native-slots-1793822971280.json (pre-unload) and preserved-native-slots-1793822987838.json (post-startup/pre-Continue); audit-187-nov04-source-qualified-reload-1793822976599.json; repaired-hall-return recordings ending 7830 through 7833; final-comparison.png. Front door remains Planmap Project progress, with canonical records retaining authority.

### Completed installed-version interior control

A final task-body check identifies the missing r172 interior window. The revised method uses the already physically reached and saved hall feet, without repeating the failed r172 return walk. Fresh normal Continue and To Player admit a stationary view of Nell beside the hall bed. The r187 Standard 20-second control records 47.39 FPS; after preserving native slots, switching only the isolated Three dependency and fully reloading, the r172 control records 50.19 FPS. Body-relative eye and target offsets and feet match exactly with zero maximum difference. Both windows are valid, stable before/after, have p95 33.4 ms, no captured errors and no visibility changes. Displayed r172 walls and body render without the r187 speckling. These are single shared-host version-control windows in a different camera view from the four r187 hall ABBA windows; no three-way same-camera timing table is claimed.

Both streets and interiors now have separate matched r172/r187 version controls plus the eight matched r187 Standard/Meshlet ABBA samples. The earlier unmeasured r172 interior return remains a failed historical interval; the stationary control supersedes its missing-baseline limit. The conclusion stays unchanged: retain production r172 and reject promotion of the current Meshlet/upgrade candidate.

The last r172 full-reload audit is pinned to the seven slots exported at the title after storage recovery and before Continue, preserved-native-slots-1793823778503.json. The recovered source autosave SHA-256 is 11218ed42cfe21662e49a3a30250a9437b1d19a9c9fd616f3e6c0dd2b51df7a8, saved time 0351-01-01T17:42:40.000Z. It again matches 137 of all 139 runtime groups; only clock and live banter diagnostics differ. No groups are missing; manual SHA-256 b9cfa18cb3946e63ffa68564c34ffff891ab071c26a53cc2f3721e3ee7563075 stays byte-exact. No movement, new conversation, rest, goods transfer, fixture import or original-origin operation occurs in these final controls. The owned game tab and experiment server are closed afterward to stop unattended clock advance. The r187 control's cold tab binding initially times out at ten seconds, then recovers with the same tab under documented 30-second initialization; it is another controller limitation, not timing evidence.

Parent rendered Planmap verification opens the explicit Project progress index and town-community-focus on the existing 3017 server. The final measured/no-promotion town heading and 137/139 receipt render inside the shared snapshot. Back to Planmap returns to the roadmap. The generic view retains all seven rendered project panels. The Tracker link opens the actual canonical record; five canonical URLs return HTTP 200 and match their local records, including North Star's byte-order mark normalization. All 133 static checkbox states and peer panels remain preserved. MemPalace is unavailable on the current command path, so no mining is claimed. Source-only diagnostic/harness repairs do not establish that host timeout propagation is fixed; WF-G373 remains open.

Receipts: version-control-hall-summary.json; 187-standard-nov04-version-control-hall-1793823581718.json/png; 172-standard-nov04-version-control-hall-1793823777599.json/png; r172-final-continuity-summary.json; audit-172-nov04-r172-final-continuity-1793823777600.json; canonical-link-checks-nov04.json. The proof figure contains retained raw canvas exports, not a replacement scene or a composited UI screenshot.

### Initial attempt (November 2)

Verified: 2026-11-02 against the isolated real-game renderer, retained r172 receipt, official r187 source and preservation hashes. Qualification is incomplete. No production renderer or dependency change is promoted.

The requested comparison uses the existing World3D WebGPURenderer, an immutable copy of the accepted town application, and separate local origins. It loads Nell Ashcombe's native Serganellori save through the normal load screen. Six game save slots were copied; no cookies or unrelated site storage were copied. The original game origin was not operated. The intended controls are r172 Standard, r187 Standard, and the same r187 application with MeshletDrawingPipeline. This separates a Three upgrade from a meshlet effect. The official npm three 0.187.0 archive was checked against its registry SHA-512 integrity; provenance is retained in ignored scratch.

The one completed timing sample is a **town overview**, not a street or interior comparison: r172 WebGPU, 556 frames over about 20 seconds after five seconds of warm-up, 27.79 FPS, 33.3 ms median, 66.7 ms p95 and 916.9 ms worst interval. No visibility transition or new captured issue occurred in that window. The rendered canvas is 960 by 540 at a 1280 by 720 viewport and DPR 1.5. Retained scene coverage contains 712 meshes, 31,365 instances and about 4.05 million triangles. These are page frame intervals under shared host load, not isolated GPU time or sustained acceptance. The overview's dark vegetation is present in the control.

The initial r187 Standard run rendered the town but reported inst.append is not a function in TreeTintNodeMaterial and GrassWindNodeMaterial. A scratch-only removal of the obsolete call exposed a second failure: an instance color buffer of 96 bytes was bound for a draw requiring 708 bytes, producing invalid WebGPU command buffers and a blank scene. Its apparent FPS is rejected. r187 now shares instance shaders and binds the rendered object's attributes by reference; r172's object-captured instance helpers are incompatible with that behavior.

A second isolated compatibility attempt uses r187 referenceAttribute for the matrix and color, retaining the existing local grass sway and foliage tint calculations. After a normal manual save, full document reload and manual-slot load, the actual town and saved hall furnishings returned. The saved feet remained at cell4079, x470.63971280330503, z490.4073382328218, y4.722837280319517. The next inspected error log was empty, and the town rendered through normal zoom input. This is bounded recovery evidence, not full save-group parity or visual/material parity. The adapter reports NVIDIA Turing; its exact device name is unavailable. The native To Player action refused a clear camera position inside the hall. Orbit/zoom reached the roof exterior, not a qualified interior view.

The candidate tab then crashed during a normal orbit input check. The browser-control call returned hours beyond its requested 30-second timeout. That elapsed time is not gameplay or benchmark evidence. No meshlet timing sample completed, and actual meshlet cluster coverage was not verified. There is no measured meshlet gain, matched street/interior pair, or complete save/full-reload continuity qualification. The crash cause remains undiagnosed; neither the input nor the meshlet pipeline is established as its cause. MeshletDrawingPipeline was never selected in the retained run.

Final preservation audit: the original save export, copied fixture and immutable source manifest match their initial hashes. Primary package and lock hashes matched before the prolonged browser call. They later changed in the shared checkout; the inspected diff contains a Playwright 1.57.0 to 1.64.1 update, not this experiment's Three dependency. These unrelated edits are preserved. This lane did not edit production game source or primary dependencies. A full source-tree hash comparison was not run.

Next action: restore reliable bounded browser control, retain the isolated save, and qualify the per-object instancing port before timing anything. Compare actual street and supported interior views under r187 Standard and Meshlet with the same camera, body, scene coverage, lights, shadows and quality. Require real cluster/triangle counters, rendered inspection, repeat windows and a normal save/full-reload check. Do not substitute a demo scene or count fallback-only rendering as meshlet execution. The town-community goal remains unaccepted.

Evidence and disposable tooling: .agent/scratch/meshlet-town-ab/ (ignored), including three-provenance.json, experiment.config.mjs, preservation-before.json, preservation-after.json, receipts/172-standard-town-overview-1.json and .png, and the pre-compatibility/manual-save audits. Agora task: agora-da70. The existing Planmap Project progress view remains the presentation entry point; these records remain authoritative.

## Page meter (pages with no 3D)

The page meter measures fps and freezes for the whole page. It works on pages that draw no 3D, such as the 2D town map. Remy asked for it on 2026-11-01, when a capital took a long time to build and the pill said only "no 3D".

How it works:

- `src/devtools/perf/pageFrameProbe.ts` runs one animation-frame callback per browser frame. The interval between callbacks is the page's own frame time, whatever draws it.
- The meter is a normal session in the registry, with id `page` and label "Page (all drawing)". The panel, the pill, the copied report and `window.__araliaPerf` read it like any other surface.
- `PerfOverlayHost.tsx` starts the meter when the display mounts and stops it when the display goes. So every page with the staple, and the game in dev mode, has it. No page needs a new line.
- A drawing 3D surface keeps the pill. The page meter takes the pill only when no 3D surface draws. The pill then reads "N fps · page".

A frame interval of 250 ms or more is a gap. A 100 ms timer (the heartbeat) gives each gap one of two kinds:

- **Freeze**: the heartbeat stopped too, so the main thread was blocked. The pill shows "froze N s" in red for 30 s after the freeze ends.
- **Held**: the heartbeat kept running, so the browser held frames back for a hidden or throttled view. The pill shows "frames held N s" in gray. A held gap never counts as a freeze.

Chrome's Long Animation Frame reports name the cause of a freeze: the scripts in it, by function and file. The report never decides the kind of gap. Chrome can deliver it more than 10 s late, while more long tasks follow. A first version that waited 10 s for a report called a 13.9 s world-generation freeze "held". The Claude app's browser pane holds frames to one every 2 s while it is out of view. Its live fps is therefore not a measurement; use headless Chrome for numbers.

The meter cannot show anything during a freeze, because the display runs on the same main thread. The length appears when the freeze ends. The meter has no GPU clock and no draw counts.

Proof: `.agent/scratch/town-look/capital-meter.mjs` (ignored) opens the town page in headless Chrome, picks a band and reads the page meter.

## Resident GPU device capacity failure

Verified: 2026-10-21 against the reported validation error, current Three r172 device creation, resident buffer layout and staged candidate checks. Repair is NOT applied and actual-device/live stepping verification is pending.

The user reports binding 3 at 190,868,272 bytes exceeding the device's default 134,217,728-byte storage binding limit, while the adapter advertises 2,147,483,644 bytes. The view creates its shared render/solver device without requesting a larger storage limit. The resident course is 4420 by 1339 cells; its exact source/summary buffer is (2 * cells + 32 + ceil(cells / 64)) * 16 = 190,868,272 bytes. This is a device-request mismatch, not proof of insufficient hardware capacity.

A separate full-grid dispatch issue is visible in source: 92,475 workgroups exceed WebGPU's 65,535 per-axis limit. The staged candidate requests only adapter-supported binding/buffer growth, rejects insufficient returned-device capacity before allocating or changing water, and maps large dispatches onto two rows with the original linear cell order and guarded reduction padding. Equations, grid, solver steps and shading are unchanged. Recovery also prepares limits before creating a replacement renderer device. The synchronized path's 284,082,240-byte readback allocation is included in maxBufferSize negotiation.

Six focused staged tests pass. Four-file helper/resident/step/test scoped types and a separate staged view check against unchanged real dependencies each report zero errors and zero suppressed diagnostics. These are structural/capacity checks, not executed WGSL or live repair acceptance. Staged source, preimages, review.patch and a guarded, UNEXECUTED apply script are under ignored .agent/scratch/water-limits. Production source files remain unchanged in this lane.

Browser inventory lists the current river tab, but repeated binding/control attempts time out, including browser selection without page inspection. User was asked to reconnect control. Do not trigger HMR while unable to protect the live epoch. Device limits are immutable after creation; promoting source alone cannot enlarge the already-created live device. Reconnect, preserve accepted worker state and camera, explicitly replace/rebind the shared device, protect every source/header write, then qualify actual large binding, second dispatch row, rejection recovery and advancing healthy live water. No restart, camera replacement, quality reduction or 30 FPS claim is authorized by these structural receipts.
## Actual current interaction performance

Current user objective (2026-10-21): profile and repair the actual current camera/edit/flood view, preserving camera, interaction, source, water physics and visual quality. Sustain at least 30 FPS HERE. Historical 24.6/26.5 FPS windows do not describe this workload and are not acceptance. A quiet GPU window is not a prerequisite for profiling this view. Owner: codex-water-current-01a15aa5.

Actual-view recording: 110.2 seconds, 1,538 frames, 14.0 FPS mean, 71.6 ms mean, 207.1 ms p95 and 85% of frames over 33 ms, at 1576 by 968 and DPR 1. GPU mean 20.56 ms. The user continues moving the camera; no pose, source, flood, edits, resolution, physics settings or render holds are changed by the profiler. The active source is 120 cubic meters per second during the existing flood, with healthy advancing CPU physics and zero restore/top-up/edit correction counters. This is an interaction recording, not a fixed-pose paired comparison.

A 26.8-second actual-view CPU trace attributes about 5.04 seconds inclusive to waterfall updateSourceMap, 4.82 seconds inclusive to course projection beneath it and 4.49 seconds self samples to its nearest-sample tree visit. Recursive inclusive visit totals must not be added. The unchanged 128 by 128 source grid projects all 16,384 cells again at each transient-atlas update. A geometry-only Float64 projection cache is prepared in riverSourceMapProjection.ts, retaining s/n/tangent/crest-forward results while every hydraulic texel remains live. Its 655,360-byte fixed cache invalidates on course instance, grid or crest changes. The approach owns an immutable readonly course. Three focused tests pass, including every stored bit for the actual 128 by 128 grid; two-file scoped typechecking has zero errors and zero suppressed diagnostics. This helper is now wired into the production waterfall after complete source-map and half-texture parity checks; a candidate preimage remains ignored scratch.

The user reconnected a newly initialized tab. This is a new simulation epoch at the default overview, source 1.5 cubic meters per second, not recovery of the earlier flood/edit camera. The profiler never reloads, moves its camera, resets physics or changes quality. Its native baseline is 24.9 FPS over 46 seconds. The prepared source-map method is applied in place after complete Float32 and half-texture comparisons at discharge 0, 1.5 and 120 give zero differing channels. Three focused tests and two-file scoped types pass; the production waterfall now imports the helper.

A conservative opaque-refresh candidate retains unchanged main color/depth attachments and redraws every possibly animated caustic region plus previous/current floater footprints. Reflection and water run natively each frame. Camera, terrain, hydraulic fields, lighting and unsupported interactions invalidate reuse and use the complete native path. It preserves all geometry, shaders, resolution, MSAA and simulation. Correctly padded nonzero GPU copies compare opaque/reflection outputs with zero differences at two times; final-water differences stay within the native repeat control of two half-bit units. A positive animation control observes changing caustics, reflection and water. No render hold or pinned clock is used.

The one-rectangle CPU-bounds version reaches 28.3 FPS over 81.4 seconds, with 26.74 ms GPU mean, but introduces 60–80 ms metadata scans. A read-only GPU reduction replaces those scans; metadata applies only to the identical current field array, with full native fallback while unavailable or invalid. Its 144.3-second capture records 4,217 frames, 29.2 FPS, 34.2 ms mean, 56.3 ms p95, 46.8 percent over 33 ms and 26.30 ms GPU mean at 1576 by 968, DPR 1. This is progress, not 30 FPS acceptance. A fresh CPU trace still identifies native opaque submissions and waterfall display work. Exact undeformed cross-section reuse is the next bounded experiment; its initial 45-case section and current full-vertex comparisons have zero differences.

Index reordering, tighter instance/triangle culling, bump/shader sample sharing, guarded/branchless soil shading and two-rectangle refresh candidates fail to deliver sufficient sustained improvement and are removed. Current candidates remain reversible instance-only experiments. Evidence is ignored under .agent/scratch/water-current: source-map-parity.json, opaque-cache-v6-pixels.json, cache-v6-live.json and cache-v6-profile.json. Agora task agora-dfec retains the full current-view goal. No MemPalace mining has been performed for these unpromoted candidates.

Final integration boundary: the coordinate cache is promoted to riverWaterfallView.ts and three focused tests pass. Three-file scoped types report zero errors and zero suppressed diagnostics. The sandbox Vitest attempt executes no tests because of a temporary-file EPERM; the bounded unsandboxed retry passes all three. The dependency-header wave updates the two named owned source files and reports two stale dependents without writing them.

The header wave also triggers full reload for riverSourceMapProjection.ts, which the finite manual handoff guarded incorrectly: it covered only riverWaterfallView.ts. This is an agent error, not a user action or an external prerequisite. The reconnected page epoch 1792543740577.2 is lost and replaced by 1792547746427.7. The agent informed the user immediately, stopped live experiments and did not move the camera or run replacement acceptance. The original running state cannot be recovered from these receipts. No source code changes water physics or visual settings, but the required live-state continuity is violated.

The precise pixel-mask prototype averages a rounded 30.0 FPS over 52.9 seconds, with 55.4 ms p95 and 41.7 percent of intervals over 33 ms; this is NOT sustained 30 FPS acceptance. Direct hydraulic fragment rejection regresses to 26.6 FPS over 37.3 seconds. Its bounded variant reaches 29.3 FPS over 30.1 seconds (source handoff occurs during that window, so it is not clean acceptance). All render-cache variants remain scratch only and disappear with the reload. Exact canonical-ring caching also fails to improve sustained pacing and is removed. The source projection-cache fix remains; the target is unmet.

Next investigation, unexecuted: isolate why exact flow uploads still occupy roughly 18–31 ms of snapshot texture-queue handling. The upload helper passes a complete 47 MB ArrayBuffer plus a dirty-region offset; test whether restricting the supplied byte view to the exact required strided span reduces browser copying without changing any source bytes, row stride or dirty rectangle. This is a hypothesis, not a measured cause. Any subsequent live acceptance needs an explicitly acknowledged new epoch and a handoff guard covering every source/header write; do not claim it preserves the lost run.

## Historical reference-course transfer and terrain repair

Current user objective (2026-10-21): reach at least 30 FPS in the live reference-course scene without reducing water physics, geometry or visual quality. Owner: codex-water-fps30-01a15aa5. The prior 14.3 FPS result is inadequate. Fresh default-camera baseline: 9.7 FPS over 62.1 seconds at 1576 by 968, DPR 1, 856 draws and 27.3 million triangles. Profiles identify repeated whole-terrain validation, opaque submission and browser-thread full-field dirty scans. Exact comparisons now run in the existing mapper worker, with validated epoch/revision lineage and full-scan fallback; its fixed 142 MB cache is the memory cost. Immutable live snapshots support unchanged interpolation without the 24 MB level-array copy. Integrated snapshot handling measures roughly 3–6.5 ms instead of 70–90 ms. Source-owned terrain revisions avoid repeated validation between committed edits. Native opaque attribute/material buckets retain all triangles, vertex fields, original edit/shadow owners and moving/preparing-camera fallback, while reducing 655 terrain batches to 18.

Normal-HMR final-source verification records 24.6 FPS over 39.1 seconds at the default overview (219 draws, 27.3 million triangles). The exact historical 14.3 FPS camera records 26.5 FPS over 48.8 seconds, 37.8 ms mean, 65 ms p95 and 220 draws. Physics advances with healthy, unpaused CPU simulation, the 1.5 cubic meter per second source and zero restore/top-up/edit corrections. An earlier in-place native run reaches 28.3 FPS over 112.7 seconds; none of these sustained runs meets 30 FPS. GPU pass means vary from 16 ms baseline to 28–37 ms later, so elapsed FPS alone cannot attribute the entire change to code. With only this renderer held and CPU physics still advancing, NVIDIA reports 66% GPU utilization and the shared Codex GPU process retains 52–56% 3D activity. This establishes residual GPU work outside this render loop, but does not identify its owning tab or app. Peer quiet requests have no acknowledgment. Later shader, vertex interleaving, tighter frustum and instance-order experiments do not improve sustained FPS enough and are removed. Current live interaction subsequently changes the camera and starts a flood surge; it is a different workload. Next: obtain a controlled GPU window, repeat the matched source recording, and finish rendered terrain-edit/shadow verification. The 30 FPS requirement remains open.

Pixel-evidence correction: the initial Three r172 readRenderTargetPixelsAsync comparisons were INVALID. Its row-padded copy used an undersized destination buffer at these widths and returned only zeroes. Correctly allocated row-padded GPU copies, validation scopes and nonzero controls replace those receipts. They detect animation and reject the command-cache candidate:191 opaque pixels differ, even after an order correction. That candidate and its test were removed from production, retained only in ignored scratch. Native format packing instead differs at one opaque pixel (3 half channels,max162 stored-bit units) from the original small batches; reflection is bit-identical. Native final-water repeat controls already vary by1-2 stored-bit units across roughly1200channels. No geometric or optical quality reduction is made, but exact whole-target identity is not claimed. Fresh source and the matched camera are measured above. Rendered terrain-edit/shadow acceptance remains pending; focused revision and fallback tests pass. Proof lives in ignored .agent/scratch/water-fps30. Preserve the separate full-water acceptance requirements.

The CPU-backed reference-course preview had two measured bottlenecks. One 38,346-vertex native terrain tile exceeded the batcher's 32,000-vertex derived-buffer limit. This rejected batching for all 3,525 terrain tiles. The repair retains that singleton as its original mesh, in native depth order, and batches the supported tiles. Cleanup releases only derived geometry. Native editing ownership, original shadow casters, culling and camera-movement fallbacks remain.

Each flow snapshot also resent three complete 47,347,040-byte half-float textures: 142,041,120 bytes per snapshot. `riverFlowTextureUpload.ts` compares every stored channel bit and uploads the rectangle containing all changes. It keeps the complete source row stride and subarray byte offset, without another staging copy. Texture dimensions, filtering, precision, solver steps, source flow and snapshot cadence are unchanged. New textures, pending native uploads and unsupported texture states retain Three's full-upload path. The bridge is qualified against the installed Three r172 WebGPU backend; another renderer version needs its own qualification.

The same running scene at camera `[45,185,92]`, FOV76 and canvas1576×968 at renderer DPR1 measured4.5FPS over20.9s/93frames on the original path. The terrain repair alone reduced submissions from2,325 to686 but reached only4.6FPS over12.9s/60frames; reversing eligibility returned4.3FPS over27.6s/119frames. This was insufficient. A separate temporary upload hold, with physics still running, reached8.3FPS over32.2s/268frames. All updates were restored. The exact-upload source helper with repaired batching then reached9.3FPS over54.3s/503frames:108.0ms mean frame,194.5ms p95. Trees remained enabled, the CPU solver and1.5m³/s source kept running, and no visual or physics setting was reduced.

At fixed hydraulic snapshot3255.7571862338773, water clock, camera and exposure, actual GPU readbacks are bit-identical for both comparisons: exact partial versus full uploads, and repaired batching versus individual native terrain draws. Opaque6,102,272channels, reflection1,525,568channels and final6,102,272channels each have zero differences. A separate actual NVIDIA WebGPU control verifies140channels, signed zero, NaN payload bits and a10-byte subarray offset with zero differences and no validation error. Temporary pause, exposure, clock and render-hold settings were restored before continuing live execution.

All19focused tests pass, and scoped typechecking of all five changed code/test files has zero errors. One three-file dependency-header sync leaves seven dependent files untouched. Disposable profiles, paired recordings, GPU readback receipts and the rendered capture are under `.agent/scratch/water-fps-repair/`; `REPORT.md` indexes the evidence.

The matched9.3FPS result is about twice the original4.3–4.5FPS, not a30/60FPS result. GPU passes still averaged47.89ms in that capture. The remaining renderer and field-publication costs remain open. This repair does not promote the seven-waterfall physics or realism gates.

Normal Vite source reload at19:22:32UTC subsequently completed. The source helper is loaded without diagnostic overrides. Live movement takes the native fallback, including the original large tile and all terrain owners; the original camera is restored afterward. The source-loaded scene then records14.3FPS over50.4s/720frames,70.0ms mean and132.9ms p95, with686draws and19.26million triangles. Frames advance790→1510 and physical time1010.45→1061.03seconds, with healthy unpaused/unsuspended CPU physics,1.5m³/s inflow and zero restore/top-up/edit correction counters. The canvas remains1576×968 at DPR1. GPU passes average17.92ms in this new run, so changed state/host timing prevents attributing the entire later increase over4.3–4.5FPS to the repair. The matched9.3FPS comparison remains the causal performance evidence. `final-source-live.json`, `final-source-movement.json` and `final-live.jpg` retain the normal-source proof. Target30/60FPS remains unmet.

## Reading slow-frame evidence

The Causes tab keeps its slow-frame evidence in a fixed 320-pixel scrolling viewport. The evidence refreshes every three seconds rather than on every 250 ms HUD poll. Hovering or keyboard-focusing the list holds that evidence; Hold list keeps it frozen until Resume list. Resume immediately shows the latest retained frames. Other HUD readings, frame collection and the scene continue throughout. Held records copy contributor and note data, so delayed GPU attribution cannot rewrite a frame while it is being read.

Each entry names its frame number. Different frames can lead with different measured contributors, because the headline identifies the largest increase above that cost's usual value. The recurring-contributor summary counts appearances across the displayed retained frames and orders names alphabetically. A frame can contain several contributors; these counts are not additive timing shares or proof of causation. All retained entries remain available by scrolling, and the copied report keeps its original live evidence.

Rendered checks confirm a 320-pixel viewport at approximately 784-pixel expanded and 337-pixel compact widths, with no horizontal content overflow in the compact list. Held evidence stays unchanged as the newer-frame count reaches 12 and live FPS continues. Keyboard scrolling reaches older retained frames; Resume returns to the newest evidence and the top of the list. Hot reload restarts the preview during development; it is not a Hold/Resume effect.

Focused presentation and existing host checks pass (8 tests), and the affected scoped typecheck has zero errors. This presentation change does not alter water quality, physics, collection cadence or slow-frame classification. Agora task: agora-1192. Disposable source backups and rendered proof are under .agent/scratch/fps-log/.

## Resident readback CPU stalls

The resident river's GPU exchange resumes JavaScript after asynchronous readback. This continuation was outside the measured render callback and short worker-message handler, so the panel previously left much of it unexplained. A four-second CPU profile attributes about 1.34 seconds of self samples to resident.run; a separate three-second browser timeline records main-thread microtask blocks of 189 and 174 ms. These are local CPU/timeline observations, not raw GPU execution clocks or additive FPS shares.

The measured repair retains all original data and checks. Finite readback validation uses the same Number.isFinite predicate in a direct Float32 scan. Reach and transient masks use one direct pass over the same topology flags, retaining the original bit operations, byte values and separately owned output arrays. The previous two mapped Uint8Array.from conversions were expensive over 544,000 cells. Native WGSL construction, input preparation, maximum slots, adaptive time steps, source allocation, returned water/flow/history/ledger values and rejection cleanup are unchanged.

RiverGpuResident optionally reports synchronous preparation/upload and readback validation/publication intervals through RiverLiveClient to the existing surface session. GPU waits and error-scope waits are excluded from those CPU intervals. Callback failures cannot change water transaction acceptance, and the page bypasses recording when measurement is disabled. These actual timestamps now appear in Main measured costs and Work between rendered frames, so the post-readback continuation is no longer hidden behind the generic frame-time gap.

Actual-device paired qualification compares every output byte across 12 native epochs and 50 steps: lake, expanding wet front, source shutdown/reopening and a bed edit. State, reach, transient masks, topology, averages, journals, per-step states/masks, duration and volume ledgers match. Rejection at step 2 retains caller state and recovers identically; a throwing diagnostic callback leaves output unchanged. This is readback-path parity on those controls, not full waterfall acceptance.

The same running user scene was measured in an ABBA crossover with no scene reload, source pause, camera input or setting changes during that comparison. The two original windows measure 18.7 and 19.3 FPS; the two combined-repair windows measure 26.8 and 26.7 FPS, approximately 41 percent higher. Window p95 values change from 179.4/207.1 ms to 83.6/80.3 ms. Mean publication time changes from 154.7/145.2 ms per call to 17.2/16.9 ms. The rendering surface stays 1576 by 968 at DPR 1, with GPU draw means around 13.4–13.7 ms in all four windows. The earlier finite-only crossover gave 17.3/18.3 versus 19.4/19.3 FPS, which exposed mask conversion as the larger remaining publication cost.

These are bounded within-page measurements under normal host load. The water state keeps evolving; an exclusive global quiet-window acknowledgement was not obtained, although the water owner confirmed its own GPU trials were terminal and its candidate tabs closed. The local gain is supported by both crossover directions and exact-output controls; it is not a general hardware benchmark or a steady 60 FPS claim. Two initial developer crossover attempts rejected stale/duplicate module bindings and restored their methods without accepting a result. A clean preview reload and the same Vite aliases as the application resolved that binding issue.

After promotion the user page was reloaded to load the final source. It remains healthy, unpaused and unsuspended, with 12 m³/s inflow, the same URL/settings and zero restores, top-ups, edit-added or edit-lost water. This reload starts a new preview run; it does not preserve the previous run's elapsed time. Rendered inspection confirms the two named resident CPU phases; live FPS varies under load, and remaining frame costs include the render callback/original waterfall display plus a smaller explicitly unexplained remainder. No visual/simulation quality setting was reduced. Later rendered motion proof shows the same healthy source advancing from 27.52 to 118.96 simulation seconds with the same zero correction counters.

Verification: 39 focused checks pass across readback validation, native GPU acceptance and live-client contracts. Four-file scoped types pass, followed by a zero-error resident-only check after the fused-loop promotion. A single three-file dependency wave updates the scene header and leaves the two other headers current; four stale dependent headers are reported and deliberately not written. Disposable receipts, profiles and screenshots stay under .agent/scratch/fps-repair/. Agora task: agora-53c7. Full water-map acceptance remains 6/33; this repair does not close the full native waterfall runtime gate.

## Maximized monitor

The square button beside Collapse expands the performance monitor across the viewport. Restore or Escape returns it to the compact corner panel. Wide views put the live diagnosis and selected detail tab side by side; narrow views stack them. The graph follows the available width, and the header controls stay reachable while scrolling. Maximizing preserves the selected surface, tab and open disclosures. Minimizing to the FPS pill and reopening retains the expanded-size choice for that mounted monitor.

This is a change to the monitor's own portal. The measured scene stays mounted and visible beneath the translucent panel, with its canvas size and rendering/simulation settings unchanged by maximizing. No browser fullscreen request, scene pause or scene remount is used. Browser viewport changes for responsive testing are separate from the maximize control and naturally resize the scene.

Rendered checks on the original resident-river page cover the normal 1633 by 1244 viewport and a temporary 680 by 900 viewport. Both maximize and restore work; Escape returns the narrow panel to its corner, the restore button returns the wide panel to its corner, and minimizing/reopening keeps expanded mode. The selected Causes tab survives size changes, and live readings continue behind the expanded view. The wide scene canvas remains 1576 by 968 when the monitor expands. A shorthand-positioning restore bug was found in the rendered check and repaired using individual edges. Four existing host checks pass, and the final scoped typecheck has zero errors. Shared hot reload and one explicit reload restarted the preview during development; these checks do not establish an FPS gain. The viewport override is cleared, and the monitor is left expanded. Agora task: agora-f1d4. Ignored proof: .agent/scratch/fps-maximize/expanded.png, narrow.png and verification.json.

## Matched frame attribution

The shared panel now ranks main measured costs and shows where time went in the same completed frame intervals: render callback, other main-thread scripts, browser rendering phase and still-unexplained time. A colored bar uses those four exclusive portions. GPU samples overlap this timeline and are not added to it. Callback spans such as Original waterfall display remain labeled rolling detail inside callback time.

The renderer probe records actual callback windows, synchronous render submissions after an asynchronous continuation, other page animation callbacks and synchronous Worker/MessagePort message handling. Await gaps are not counted as CPU work. Message listeners retain their property getter identity, removal, capture, once and object-listener behavior. Measurement bypass skips this timing. Handler source comes from one registration stack; there is no per-message stack collection. These clocks measure main-thread handling, not worker execution or asynchronous work after a handler returns.

Browser Long Animation Frame reports add named scripts and rendering-phase intervals, including delayed reports. Script duration starts at the browser's startTime, with executionStart used only as a fallback. The rendering-phase tail includes related browser rendering work; it is not an isolated paint or GPU clock. When only Long Tasks are available, the panel shows their duration with source unavailable. A rejected observer is reported as unavailable. See the [Chrome API documentation](https://developer.chrome.com/docs/web-platform/long-animation-frames) for its 50 ms frame and 5 ms script attribution limits.

The bounded ledger retains at most 180 frame intervals, 360 callback windows and 512 work intervals. The displayed cohort uses recent completed frame intervals. All work is clipped to that cohort and unioned: nested operations, callbacks and browser reports cannot inflate the total by being added twice. Specific instrumentation takes priority over overlapping page reports. Hidden/resumed evidence and suspension-sized gaps are excluded; reset clears the matched cohort. Existing retained severe-frame history stays separate.

The normal user resident river page renders the ranked costs, callback detail and colored accounting bar. It identifies main-thread river message handlers and React updates/scheduling that were previously absent from the short diagnosis. Observed HUD sampling was about 2.2 ms per 250 ms poll in one live reading. This is not an isolated overhead benchmark or an FPS-gain claim. Source changes triggered hot refresh and a clean reload; no river simulation or rendering settings were changed for a timing comparison.

Remaining unobserved time is explicit. Unreported scripts, task scheduling, presentation, native/driver waiting, worker work and raw GPU work outside the available clocks cannot be assigned causal shares by subtraction. Page-wide scripts can affect more than one canvas; their overlap is evidence of main-thread occupation, not exclusive ownership by this surface. The copied report includes the matched window, exclusive source list and browser coverage. Agora task: agora-f48c. Disposable proof and focused-check receipts are under .agent/scratch/fps-attribution/. Final verification: 101 focused checks pass across five files; affected scoped typechecks have zero errors. The six-file dependency pass updates five headers and leaves one current; ten dependent headers are reported stale and are deliberately not written outside the task scope.

## River-map tree visibility

Camera and flow inspection includes a default-on Show trees checkbox. It reuses the native per-instance visibility masks for camera trees, near/far mirror copies, static shadows and the underwater air capture. Mixed canopy draws retain their shrub instances; grass and bank shrubs stay visible. Toggling does not reseed the forest, change terrain or change hydraulic state. It refreshes the shadow maps, air-capture revision, culling and performance heatmap so hidden trees do not leave stale reflections or red silhouettes. The preference also applies when the view is rebuilt inside the same component.

Actual user-page wide and narrow on/off interactions are verified. At the recorded wide camera, 1,241 pure-tree instances and 1,414 mixed-canopy instances draw with trees on. Switching off zeros the pure-tree camera and mirror counts and the all-tree conifer canopy; the mixed broad canopy retains 12 visible understory crowns and 11 in its mirror. Grass and shrubs remain. Actual screenshots show trees and their shadows disappearing, then restoring. The control stays accessible at 680 by 900; the existing open performance panel covers much of that narrow scene, so this is not a general narrow-layout acceptance. The normal viewport and prior camera are restored, trees are left off, and the user's heatmap is re-enabled.

Six existing vegetation construction checks pass. Four-file scoped types and the final view check have zero in-scope errors, with one pre-existing imported diagnostic suppressed. The first test launch executes no tests because a temporary Vite cache rename gets EPERM; an owned TEMP/TMP directory and one worker resolve that launch issue. One scoped dependency sync leaves all four headers unchanged. Proof is ignored under .agent/scratch/river-trees-review/.

Development hot refresh rebuilt the normal user river during implementation. This is therefore not an unchanged-state FPS comparison, and no general performance gain is claimed. Subsequent tree toggles keep that new run healthy and advancing with unchanged source history and zero restores/top-ups/edit-added/edit-lost water. The separately retained all-seven source document 1792248480905 is preserved and reaches 1139.095312501 seconds, healthy and unpaused. Full waterfall acceptance remains unchanged.

## River-map performance heatmap

The river drop menu now includes a default-off Performance heatmap under Camera and flow inspection. It measures full-versus-omitted offscreen native draws at the same frame state with WebGPU pass timestamps. One warm-up and four alternating-order pairs per group filter unsupported or noisy results. Transparent red follows reliable positive net GPU milliseconds saved; shared geometry is labeled and tinted as a whole. Clear areas can be unmeasured, outside the bounded18-group scan, or uncertain. This is a GPU drawing diagnostic, not a causal per-cell FPS or worker-simulation map. Readbacks reuse the renderer clock without polluting normal pass totals. An actual main-page failure found all four HUD slots busy; one dedicated diagnostic slot now prevents starvation while preserving the four native frame slots, bounding the total at five. Exclusive capture prevents overlap. Normal rendering, source, physics, batching and quality are preserved, and disabling disposes tint resources. Camera/size or bed changes invalidate the scan.

Actual isolated wide/narrow rendering and a complete10-group GPU scan pass. Initial view measured vegetation5.308416ms, shared large draws3.325952ms, water0.557056ms and one patch0.638976ms; remaining patches were uncertain. These are local, non-additive measurements under shared GPU load.12 focused tests and six-file scoped types pass, plus the repaired timer scoped check. The main page completed13groups beside its FPS monitor, and refreshed wide/narrow scans completed. Visible red disappears on disable; paused native state, source history, volume, camera and batching are preserved. Earlier off/on/off image crops retain small differences, so byte-exact restoration is not claimed. A three-frame paused drained draw comparison measured36.3mswithtintversus27.33mswithout; this bounds observed diagnostic overhead, not live FPS causality. Normal resident source flow was resumed and verified healthy. Source: riverPerformanceHeatmap.ts, RiverReachView, RiverDropMenu, RiverScene and the shared webGpuTimer/rendererProbe capture API. Proof stays ignored under .agent/scratch/waterfall-terrain/full-course/isolated/heatmap-*.

Renewed user-page verification on 2026-10-17 reuses the existing feature without production edits. At 1280 by 720, switching off removes the red overlay and a fresh 10/10 scan measures reliable omission savings of 6.160384 ms for vegetation, 2.981888 ms for shared large draws and 1.277952 ms for water; seven patches remain uncertain. These local measurements are non-additive and taken under concurrent load. At 680 by 900, the controls remain accessible and the new 12/12 scan finds no reliable positive difference, so it correctly draws no tint. No exact FPS attribution or narrow-pane reliable color is claimed. The original document 1792232823314.4 and source history are preserved, its unpaused healthy clock advances, and restores/top-ups/edit-added/edit-lost water remain zero. Normal viewport is restored and the heatmap stays enabled. New proof: ignored heatmap-renewed-wide-off.jpg, wide-on.jpg, narrow-on.jpg and verification.json in the existing isolated proof directory. Existing source tests were not rerun for this verification-only checkpoint.

## Earlier performance checkpoints

Severe FPS checkpoint: user-reported 3 FPS remains unresolved. The current Seven Sisters view initially measured23-32FPS, CPU21-22ms and GPU6-7ms, with18-20ms receiving geometry per snapshot. The FPS tracker now retains the five worst visible intervals100-1000ms (longer gaps retain the existing possible-suspension exclusion) independently of its relative-stall baseline, including sustained slow startup; each keeps same-frame CPU parts and overlapping named operations. Hidden/resumed gaps are excluded; retained evidence survives suspension and rolling-window expiry, is cleared by explicit reset, and appears in copied reports. Nested measurements are explicitly not additive, and interval GPU attribution stays unavailable. Thirty-four focused tests pass and three-file scoped types pass; dependency sync leaves two headers unchanged and the test outside the graph, with six dependents advisory-only. Rendered native inspection verifies the new panel. It captured443.5ms with29.4ms callback, and762.3ms during course reopening with399.7ms callback including352.4ms main render pass. These are observed stalls after an instrumentation reload, not reproduction of the original sustained3FPS episode or a proven cause. Seven Sisters source and running state were restored; final rendered view was32-33FPS, CPU21.3ms/GPU7.1ms, delivered physical pace0.047x. No water solver, geometry, optics or performance optimization was promoted. Full acceptance remains6/33,W06active,ENERGY_UNKNOWN. Evidence: cascade-contract/severe-fps-native.png and severe-fps-native-dom.txt; three changed perf files and focused tests.

Next action: prioritize the user-reported severe FPS failure. Use the retained worst-interval evidence to distinguish render submission spikes from inter-frame browser work; do not assume current averages explain the historical3FPS. Keep the existing receiving worker defaultOFF until its prepared matched OFF/ON geometry/pixel/runtime check qualifies. Fresh broadcast6468 and actual direct message6469 to registered orch.vega request a180-second quiet measurement window; no ACK or GPU hold exists. Earlier say bodies beginning @orch.vega were broadcasts, not direct delivery. No benchmark is running. Continue independent CPU diagnosis with exact-output proof while coordination is pending; preserve source/runtime/pixel quality. Saved shared-interface transport operand diagnosis remains a separate physical prerequisite, with no blind retry of failed repairs. Pro service error is not an active research wait.

Section sampling experiment rejected: preparing the common texture rows within each liquid cross-section retained 336 full-section/edge cases and 71904 scalar values exactly. Eighty warmed browser section batches improved from 1.6853 to 1.4881 ms (11.7 percent), but the complete display update improved only from 9.2167 to 9.0033 ms (2.3 percent), while p95 worsened from 12.1 to 12.3 ms. Forty-three states matched 28696824 geometry attribute values, including dry/normal/flood rates and source off/on. This marginal full-update evidence does not justify adding the helper; it remains scratch-only. Production SHA256 7acf5b4227ea03f585ff7010a6148f0bad6da421bd41749d6169d0ed07669444 matches the pre-experiment file exactly, retaining the accepted normal optimization. The first full-update observation timed out without a retained result; the page and cached module were verified responsive, then one receipt-bearing check completed. No running experiment remains. Native Seven Sisters continues source on/running, time67.7167s, no simulation/display errors, delivered pace0.0531x. The previous turn was progress; this turn supplies a rejected candidate and revised priority, not another live speedup. Full acceptance remains6/33,W06active,ENERGY_UNKNOWN; native drain timeout and physical/optical/runtime gates remain open. Evidence: cascade-contract/section-row-browser-result.json, section-row-whole-result.json and section-row-live.json.

Next action: prioritize the missing wet-impact/lip transition that prevents the tested analytical airborne transport from becoming a credible fast live flow. The current four-layer Film is a hydrostatic bed-attached model; its standalone junction explicitly excludes submerged impact and retained storage. Source inspection of Basilisk layered/nh.h confirms that vertical momentum and a coupled nonhydrostatic-pressure/free-surface solve are additional equations, not a metadata or admission fix. Audit an existing local two-phase/free-boundary candidate for one span-uniform wet ledge and real lip, with actual material geometry and pressure-free release; first reconcile its recorded rejection and resource limits rather than restarting a failed solver. Keep this limited experiment separate from qualification of all seven 3D courses. Do not spend the next turn on another marginal section/atlas micro-optimization. A new concise model-decision question was sent once in the existing Pro chat after primary-source inspection; it briefly showed responding, then returned Unknown error. It is not an active wait and must not be blindly resent. Continue useful primary-source and existing-code work. Receiving-worker native qualification still needs coordinated quiet ACK6428/6429/6439; no GPU hold. Preserve live water, all accounting, native optics and the full physical/runtime bar.

Waterfall normal rebuild checkpoint: live CPU sampling attributed substantial original-display work to Three.js normal rebuilding. The native original apron and strands now use an indexed-buffer path preserving the same face order, Float32 accumulation, normalization and every vertex/triangle. Unfamiliar, normalized, interleaved and nonindexed layouts retain the engine fallback. Across 64 deformed mesh states, 692832 normal values match exactly; both integrated native meshes also match fresh Three.js normals exactly. Fifty-six warmed alternating browser pairs reduce the two-mesh normal operation from 1.8726 to 0.2509 ms, an 86.6 percent operation saving, not a matched whole-scene FPS gain. Four focused tests and three-file scoped types pass; one imported type diagnostic is suppressed. Dependency sync completed once for the changed wave. An initial promotion anchor guard stopped before production writes and caused a missing-helper test failure; the exact original-apron anchor was corrected and all four tests rerun successfully. Hot reload temporarily reset selection and telemetry; refreshing the existing development handle recovered it without a duplicate renderer. Seven Sisters was restored with source on and running, advancing from 2.95 to 6.7917 seconds, no simulation/display/console errors. Rendered proof shows 37 FPS, CPU callback 19.54 ms, GPU passes 5.99 ms, original display 6.1 ms/frame, receiving geometry 14.5 ms/call, and only 0.054x delivered physical pace. This does not reproduce or explain the earlier 3 FPS episode. Full acceptance stays 6/33, W06 active, ENERGY_UNKNOWN; native drain timeout and wet-impact/lip model remain open. Evidence: cascade-contract/original-display-profile.json, water-normal-parity.json, water-normal-browser-proof.json, water-normal-integrated.json, water-normal-live.json and water-normal-native.png.

Next action: target the remaining measured receiving-geometry main-thread cost, about 14.5 ms per snapshot, by qualifying the existing default-off worker with matched native OFF/ON timing and pixels after fresh coordinated GPU quiet acknowledgement. Requests 6428/6429/6439 remain unanswered; no GPU hold or isolated GPU benchmark exists. While awaiting coordination, attribute and reduce original liquid-section/atlas CPU work only with exact output parity and measured savings; normals are already optimized, and rejected cell-index, footprint, cache and cadence experiments must not be repeated without new evidence. Preserve real physical ticks, all water accounting and visible geometry. Delivered physical pace remains roughly 0.05x, so keep the analytical-transport and wet-impact/lip research route; Pro remains at its last verified service error. Keep the native preview running and capture a recurrence of 3 FPS rather than inferring its cause from this different view/state.

Fixed rock identity checkpoint: the native flow now reuses the exact geometry identity only for rock surfaces copied and deeply frozen by its own fixed-terrain constructor. Mutable caller geometry still recomputes identity; release-local validation, contact equations and original face order remain. An alternating 64-state comparison including source shutdown/reopening and outer rollback/replay is exact. Fifty-six warmed samples reduce outer-checkpoint plus advancement mean from 74.2093 to 65.4736 ms (11.8 percent); this is an operation-level CPU result, not a matched FPS improvement. Twelve focused tests pass, including immutable/mutable geometry, restored identities, stale release guards, sub-ULP departure, subnormal rollback and public snapshot isolation. Two-file scoped types pass with zero errors and zero suppressed diagnostics. A preceding spatial-cell candidate reduced face visits from 4333554 to 494761 across 481506 movement queries, preserving 64 states, but slowed complete measured work from 73.8821 to 82.2452 ms; it remains scratch-only and rejected. Hot reload reset the scene; the existing Seven Sisters selection was restored and resumed with source on, advancing to 3.5583 seconds without simulation or display failure. Rendered proof observes 27 FPS, 24.27 ms CPU callback, 7.82 ms GPU passes and only 0.043x physical pace. These concurrent, growing-state readings do not explain the earlier 3 FPS episode or establish acceptable runtime. Full acceptance remains 6/33, W06 active, ENERGY_UNKNOWN; the prior drain-test timeout remains unresolved. Existing Pro still shows Unknown error, not active generation. Evidence: cascade-contract/geometry-identity-parity.json, terrain-index-parity.json and fixed-identity-native.png.

Next action: prioritize the remaining measured main-thread display cost for the user FPS issue: the original waterfall still takes about 9 ms per frame even in the Seven Sisters view, and receiving geometry about 18 ms per snapshot. Attribute which original presentation work remains necessary to the current camera and reflection pass before proposing any visibility-based suppression; preserve physics and water ownership independently of drawing. Qualify the existing receiving worker only after fresh coordinated GPU quiet acknowledgement; requests6428/6429/6439 remain unanswered and no GPU hold exists. Do not repeat the rejected cell index or cadence-budget increase. Physical movement remains far below real time; retain the analytical-transport and wet-impact/lip research route, with the existing Pro service failure visible. Preserve the running preview, capture any recurrence of 3 FPS, and keep joint physical, optical and practical runtime acceptance.

Waterfall cadence experiment rejected: an isolated 64 ms inspection allowance retained the same 1/120-second ticks and four-tick request cap. Forty actual native ticks, source shutdown/reopening, ten complete endpoint states and ten complete surface packets matched the unchanged 8 ms implementation exactly. Paused requests advanced no water. Whole CPU command work included physics, public snapshot, qualified surface construction and presentation packing, without a renderer/device. Baseline made 40 publications in 8595.18 ms; candidate made 32 in 7509.58 ms, only 12.6 percent saving. Candidate whole-command p95 was 284.48 ms (baseline 288.77 ms), failing the predeclared gate of at least 20 percent total saving and p95 at most 250 ms. These are CPU command durations, not measured native input latency or GPU timing. Candidate remains scratch-only; production scheduling is unchanged. No budget ladder or repeat was run. Native Seven Sisters remained running with source on, no reported error, and advanced from 31.8167 to 38.65 seconds during this investigation. The earlier native individual tick around 40 ms already exceeds its 8.33 ms physical increment by roughly five times; presentation changes alone cannot establish real-time runtime. Full acceptance remains 6/33, W06 active, ENERGY_UNKNOWN; prior native drain timeout and wet-impact/lip model stay open. Evidence: cascade-contract/cadence-parity.json, cadence-parity.ts, before-cadence.ts and cadence-candidate.ts.

Next action: attribute native collision candidate work and assess an immutable terrain spatial index so parcels query nearby faces instead of visiting every face each contact iteration. This differs from the rejected per-face footprint check, which still visited all faces and added overhead. Require conservative candidate coverage, original face order/tie behavior and all release-local validation, exact full-state/source/drain parity, and measured physical-tick savings before integration. Do not raise the 64 ms cadence allowance after its failed gate. Separating surface publication remains a possible scheduling design, but cannot alone overcome the observed physical-tick cost; keep control responsiveness and snapshot/state ordering explicit. Receiving-worker native qualification still needs fresh quiet-window ACK6428/6429/6439; no GPU hold or fresh ACK. The existing Pro wet-impact/lip question remains at its last verified service error. Keep live water usable and preserve all physical, optical and practical runtime acceptance.

Waterfall public snapshot checkpoint: native CPU attribution on 5235 parcels measured 16.30 ms per complete snapshot, dominated by parcel-copy construction and allocation. The public copy now uses a stable native record layout while retaining independent mutable vectors, optional property presence and the original fallback for extended metadata. Sixty complete old/new snapshot comparisons and 24 advancing states (including source off/reopen) are exact. Fifty warmed alternating samples average 17.2951 ms before and 10.2309 ms after, a 40.8 percent snapshot-operation reduction; this is not a matched whole-scene FPS gain. Public mutation isolation and extended metadata parity pass. Twenty-six focused tests pass across snapshot, provenance, terrain comparison and selected existing rollback/subnormal guards; scoped types pass with zero errors and zero suppressed diagnostics. The initial new test fixture omitted required startTime, was corrected, and its three tests rerun successfully. The prior full-flow drain/restart timeout remains open and was not rerun or raised. Native Seven Sisters advanced from 4.275 to 6.008333 seconds with source on, running true and no simulation/display error; closure is about -2.03e-13 cubic meters. Rendered proof shows 31 FPS, 22.53 ms CPU callback, 7.62 ms GPU and only 0.049x physical pace. Hot reload reset the selection; the development control handle was refreshed after two command timeouts and Seven Sisters was restored, without duplicating the renderer. Full acceptance stays 6/33, W06 active, ENERGY_UNKNOWN. Evidence: cascade-contract/snapshot-profile.json, snapshot-copy-parity.json, snapshot-copy-live-start.json, snapshot-copy-live-end.json, snapshot-copy-live-dom.txt and snapshot-copy-native.png.

Next action: investigate comparison presentation cadence as well as measured physical movement. The current inspection loop stops a batch after 8 ms, while the observed indivisible native tick costs about 40 ms; therefore one costly complete surface/publication commonly accompanies each 1/120-second tick. Test a bounded scheduling alternative against exact physical states and source/pause response before integration; do not change the timestep, drop water, fake motion or claim real-time acceptance. Receiving geometry still costs about 16.6 ms per snapshot on the main thread; qualify its existing worker with matched native OFF/ON timing and pixels only after a fresh quiet-window ACK. No new message after 6442, no ACK to 6428/6429/6439, and no GPU hold. Existing Pro wet-impact/lip question still displays Unknown error with Retry, not active generation. Keep the preview running and preserve full physical, optical and practical runtime requirements.

Waterfall rollback cost checkpoint: phase attribution measured about 30 ms per tick in two rollback saves, 34 ms in movement, and 19 ms per public snapshot on the retained native warm state (nested timings overlap). Internal rollback now shares frozen birth-section and release provenance while continuing to copy evolving parcel state. Public snapshots and saved states remain independent mutable copies. An alternating actual-code comparison from the same warm state exactly matched 48 complete states and arrivals, including source shutdown, reopening, rollback and replay. Forty warmed pairs reduced mean outer-checkpoint plus advance time from 80.9992 to 69.7707 ms (13.9 percent); this is an operation-level CPU improvement, not a matched FPS gain. A preceding conservative collision-footprint candidate exactly matched 12,900 sweeps and 48 states but slowed the measured operation from 48.68 to 53.69 ms; it was rejected and restored before this change. The focused regression run passed 59 of 60 tests. The existing 40.233333-second source/subnormal drain/restart test timed out at its unchanged 60-second limit and remains unresolved; no assertion mismatch was reported. Scoped types pass with zero errors and zero suppressed imported diagnostics. Native Seven Sisters advanced from 5.3917 to 21.3167 seconds with source on, running true, no failure or display error, and volume closure about -4.14e-12 cubic meters. Rendered proof shows about 32 FPS, 20.69 ms CPU callback, 6.49 ms GPU passes and physical pace only 0.054x. Overall FPS and physical runtime remain unacceptable; the reported 3 FPS episode was not reproduced in this observation. Full acceptance stays 6/33, W06 active, ENERGY_UNKNOWN. Evidence: cascade-contract/contact-phase-profile.json, provenance-parity.json, sweep-bounds-parity.json, provenance-live-before.json, provenance-live.json and provenance-native.png.

Next action: qualify the already implemented receiving-geometry worker with matched native OFF/ON timing and pixels after a fresh GPU quiet-window ACK; measured receiving geometry still costs about 14-16 ms per snapshot on the main thread. Requests 6428/6429 and reminder 6439 have no fresh ACK, so the worker remains default OFF and no GPU measurement hold is claimed. While awaiting coordination, investigate the measured remaining physical movement/public-snapshot costs with exact-state parity, preserving full accounting and source/drain behavior. Do not repeat rejected sweep bounds or raise the drain-test timeout without new evidence. The existing Pro wet-impact/lip question remains in service-error state, not generating. Preserve the current running water, capture any recurrence of 3 FPS, and retain joint physical, optical and practical runtime acceptance.

Waterfall worker cost checkpoint: an actual-code CPU profile attributes substantial work to surface construction, temporary allocation and physical stepping. The surface builder now writes face normals and original corners directly, reuses triangle indices and moves face-invariant validation/range work outside the vertex loop. Every prism volume/centroid check remains enabled; physics, water ownership and optics are unchanged. An alternating old/new comparison across 16 native Seven Sisters states, including source shutdown, exactly matched 22,911,648 uploaded attribute values plus packet ledgers and ranges. Twelve warmed pairs reduced mean construction from 133.00 to 97.98 ms (26.3 percent); this Node result is an operation-level improvement, not a whole-scene FPS claim. Twenty-three focused prism/packet tests pass; scoped types pass for all five changed files with one imported diagnostic suppressed in the four-file pass. Scoped header sync left four headers unchanged and did not write seven advisory dependents. The existing FPS panel now exposes the complete pre-send worker command, physics plus snapshot copying, surface plus qualification, and packing as off-main-thread elapsed times. PostMessage serialization, delivery and browser reply handling are outside that worker interval; nested totals must not be added together or to render CPU. Native rendered proof shows the new fields, Seven Sisters running with source on and no error, about 29 FPS, 24 ms CPU callback and 7.2 ms GPU passes. One live worker reading is 119.3 ms total: 55.6 ms physics/snapshot, 62.1 ms surface/checks and 1.6 ms packing. Physical pace remains about 0.049x; overall FPS and physical-runtime acceptance are unresolved, and the reported 3 FPS episode was not reproduced. Reload was required to replace an older telemetry callback; the Seven Sisters selection and running controls were restored. Receiving worker remains default OFF pending fresh quiet-window ACK6428/6429; no GPU hold or benchmark. Full acceptance remains 6/33, W06 active, ENERGY_UNKNOWN; native drain timeout and wet-impact/lip model remain open. Evidence: cascade-contract/worker-profile.json, contact-face-parity.json, before-contact-face.ts, contact-face-live.json and contact-face-native.png.

Next action: use the measured remaining CPU costs, including roughly 16-22 ms main-thread receiving geometry per snapshot and 50-80 ms comparison physics/snapshot work. Qualify the existing receiving worker with matched native OFF/ON timing and pixels after fresh GPU quiet coordination; keep it default OFF until qualified. Do not repeat the accepted face-copy comparison or previously rejected caches without new evidence. Preserve the current running water while capturing any recurrence of 3 FPS. Both in-app water tabs previously reported visible, so hidden-document suspension alone does not prove contention is removed. The existing Pro wet-impact/lip question is in service-error state, not generating; poll rather than blindly resending. Full physical, optical, accounting and practical runtime acceptance remain required.

Background river work and wet-Film checkpoint: the live river client now sends document visibility separately from manual Pause. Hidden workers retain water, stop recurring solver slices and field construction, still accept edits/inspection, and resume from the retained clock without simulating hidden wall time. Listener cleanup prevents disposed clients from receiving visibility events. Twenty-seven focused client/worker tests pass; four-file scoped types report zero in-scope errors and one imported diagnostic suppressed. Scoped dependency sync left both headers unchanged and did not write seven advisory dependents. Native-worker verification used an explicitly injected visibility fixture: direct raw inspection held physical time exactly at 645.1474812490939 seconds for 2.014 wall seconds, then resumed to 648.651217831609; manual pause stayed false and no error appeared. The fixture restored document visibility. This is protocol proof, not a real tab-switch or FPS gain: both open in-app water tabs report visible even after a focus switch, so this fix does not remove their current competition. Existing native diagnostics observed approximately 17-22 FPS in the river overview, CPU callbacks 35-54 ms, GPU passes 17-20 ms and receiving geometry 16-29 ms per snapshot; camera/state and concurrent load differ from prior captures. The 3 FPS episode remains uncaptured. Hot reload reset the scene; the existing Seven Sisters view is restored with source on, running true, physical time 4.8583 seconds and no error. The final rendered panel shows 28 FPS, 24.3 ms CPU callback, 5.7 ms GPU passes and 0.040x delivered physical speed; these are an observation, not a controlled improvement. Receiving worker remains default OFF pending fresh quiet-window ACK6428/6429; no START or GPU hold. Separately, actual four-layer Film wet/wet face increments are exactly opposite, including reversed flow under backpressure. Trial re-advance to an actual prefix, full late-failure rollback and replay are exact. Mass closes at 0.2 m3 and the mechanical ledger residual is 6.4e-14 J, with 5.1542 J numerical transport loss explicitly accounted. Endpoint interpolation differs by 2.9836e-5 m3 and stays rejected. Native open-edge hydraulic energy .371431696 J differs from material kinetic-plus-potential .616681696 J by pressure work -.24525 J; hydraulic momentum divided by mass differs from primitive velocity by .495227 m/s. A wet impact and pressure-free release model remain missing; these coplanar cells are not impact acceptance. The focused question in the existing Pro chat returned Unknown error, including one retry; no answer or duplicate chat exists. Full acceptance remains 6/33, W06 active, ENERGY_UNKNOWN; native drain timeout remains open. Evidence: cascade-contract/background-suspension-native.json, background-suspension-live.json, background-suspension-native.png and wet-film-prefix-result.json.

Next action: continue the user-prioritized FPS repair with the existing receiving-worker OFF/ON qualification after a fresh coordinated GPU quiet ACK6428/6429. Keep it default OFF until matched native timing and pixels qualify it. No benchmark or GPU hold is active. The in-app browser currently reports both water tabs visible, so do not claim automatic suspension has removed their competition; investigate the actual visible-view lifecycle before changing user-owned tabs. Poll the existing Pro question in chat6acd52f1-4028-83eb-947e-5311d13d7b99 after its service failure; do not blindly resend or create a new chat. Its missing physical transition is a finite falling sheet onto a pre-wetted ledge and pressure-free lip release. Reuse the now-verified native wet/wet flux and exact trial-prefix rollback, but do not convert pressure-bearing exports into material packets by division or energy correction. Continue useful independent performance work while research/coordination waits. Capture any recurrence of 3 FPS and keep native optics, water accounting and complete physical/runtime acceptance.

Waterfall row-frame performance checkpoint: river-path lookup is reused once per apron row, and the falling-water frame once per body row, within the current update only. Source changes, dry rows, moving water and the existing optics remain intact. An actual-browser old/new comparison matched 28,696,824 attribute values exactly across 43 states, including zero/normal/flood discharge, changing time, source closure and reopening. In 120 warmed alternating changing-time samples, CPU update mean fell from 12.00 to 11.55 ms and p95 from 16.00 to 14.90 ms. This is a modest 0.45 ms CPU saving, not a controlled whole-scene FPS gain. Twelve focused dry-section/secondary-deformation tests pass; scoped types report zero in-scope errors and one imported diagnostic suppressed. No exported signature or import changed. Native rendered inspection shows Seven Sisters running with source on and no failure: about 37-40 FPS, roughly 17-19 ms CPU callback, 4-5 ms GPU passes, 14-15 ms receiving geometry per snapshot and only 0.045-0.047x delivered physical speed. The performance panel distinguishes physical pace from drawn FPS and names measured costly operations. The reported 3 FPS episode was not reproduced and remains open. Receiving refinement remains default OFF, pending a fresh coordinated OFF/ON qualification. Full acceptance remains 6/33, W06 active, ENERGY_UNKNOWN; the prior native drain timeout remains open. Evidence: cascade-contract/row-frame-browser-result.json, row-frame-live.json, row-frame-native.png and before-row-frame.ts. The completed Pro pressure/prefix decision and Film counterexamples remain recorded in pro-film-pressure-prefix-response.txt and film-prefix-api-audit.json: reject endpoint interpolation and the +0.4905 J resting point insertion. Existing finite-source and layered-Film coupling must be reused; its supercritical-only boundary rejects wet receiver backpressure and is not a verified submerged-impact solution.

Next action: poll fresh quiet-window requests6428/6429, then qualify the existing receiving worker with the prepared matched native OFF/ON timing and pixel comparison before enabling it. No ACK, START or GPU hold exists as of this checkpoint. Do not repeat the exact row-frame comparison or the rejected atlas/cross-frame caches without new evidence. While coordination is pending, audit the existing finite-source/layered-Film path and add the smallest justified actual first-substep flux-prefix experiment with exact rollback, one pre-wetted face, a split finite pulse and a real outlet. Preserve pressure work separately from material momentum, native optics and complete accounting. Capture any recurrence of 3 FPS. The native scene is inspectable and running; do not repeat blank-root recovery or reset it merely after an observation timeout. Physical, optical and practical runtime acceptance all remain required.

Comparison readout isolation: the native CPU profile identified repeated RiverScene JSX work (about 618 ms of sampled self time over 26.94 seconds). Comparison publications now notify only WaterfallComparisonPanel through a stable external store; they no longer set parent RiverScene state. Every reading remains available, including while the panel is closed. Three focused tests pass, scoped checks report zero errors in three changed files (one imported diagnostic suppressed), and scoped dependency sync leaves both source headers unchanged. An isolated rendered component check published 102 readings while the StrictMode parent stayed at its initial two renders; source/pause controls and the latest clock remained correct. This is UI overhead removal, not a measured whole-scene FPS gain. The original water tab remains registered and its read-only WebMCP tool returns Water/unified, but DOM/CDP/screenshot inspection repeatedly times out at focus emulation. No simulation restart, extra native scene or GPU benchmark was launched. Builder GPU IDLE6416 was acknowledged; no START or hold is active. Receiving worker remains default OFF. Full acceptance stays 6/33, W06 active, ENERGY_UNKNOWN; the reported 3 FPS episode and prior native drain timeout remain open. Evidence: cascade-contract/fps-ui-attribution.cpuprofile and readout-controls-verified.png; source tests: WaterfallComparisonPanel.test.tsx.

Next action: recover inspection of the existing native water tab without duplicating or restarting active simulation merely after a timeout. WebMCP read-only step lookup works, while focus-emulated inspection is unavailable; distinguish this control limitation from a proven application freeze. Once measurable, capture the reported slow-frame episode and qualify the integrated readout change with live flow and physical pace. Coordinate a fresh quiet window before the prepared receiving-worker OFF/ON comparison; IDLE6416 produced no active hold. Keep receiving refinement default OFF until whole-scene timing and pixels qualify it. Independent work can audit the completed Pro Film prefix/energy contract; preserve full physical and optical acceptance.

Receiving-worker requalification: ten current native mapper updates exactly match the existing position, normal, index and owned-face arrays, with source buffers attached. Browser installation averages 3.16 ms; the same-update main-thread geometry rebuild averages 14.43 ms. Worker refinement averages 22.91 ms and is asynchronous elapsed work, not browser blocking. Current native stale-result rejection, missing-result fallback, floater positions and pool/standing face ownership also match exactly. Eight focused refiner/mapper tests pass. These CPU checks do not establish a whole-scene FPS or pixel improvement. The existing worker remains default OFF. Quiet-window request6409 and direct follow-ups6410/6411 await a fresh response; no GPU comparison started. A bounded current-source OFF/ON replay is prepared in receiving-current-benchmark.js. Live main water and Seven Sisters are restored running with source on, no reported failure, no held frame loop and no pinned time. Full acceptance stays6/33,W06 active,ENERGY_UNKNOWN and the prior native drain timeout open. Evidence: cascade-contract/receiving-current-parity.json and receiving-current-controls.json.

Next action: poll the existing Agora quiet-window request6409/follow-ups6410-6411 before launching the prepared current-source receiving-worker OFF/ON comparison. Verify the live registered identity and existing browser handles first. Run at most one bounded180-second window with matched camera/field, paused comparison physics, pixel checks and full restoration. Enable the existing path only if qualification supports it; do not build another receiving pipeline or repeat prior rejected caches. Until the window is available, continue independent RiverScene rerender attribution or the completed Pro Film prefix/energy API audit. Full water goal and practical runtime acceptance remain open.

FPS attribution and rejected-cache checkpoint: the tracker excludes asynchronous worker-prefixed durations from browser-blocking handler ranking and keeps them in Worker and snapshot readings with explicit limits. Twenty-nine focused tests and three-file scoped types pass with zero errors; dependency sync writes only the owned panel header. Two exact-output optimizations were rejected: density-atlas factoring averages 4.00 versus 4.01 ms, and section-row caching saves only 0.20 ms warm but worsens changing-flight workloads from 2.47 to 2.82 ms. The section candidate and tests are retained in scratch; the original waterfall source is restored byte-for-byte to its pre-experiment baseline. The accepted packed transport and earlier display/receiving repairs remain. A native running-water observation averages 20.40 FPS (17.66-22.89), physical time 1.758-2.225 s, with source/running true and no reported failure. This is ordinary live preview, not a controlled whole-scene improvement; the latest reported 3 FPS episode remains uncaptured. Full acceptance stays 6/33, W06 active, ENERGY_UNKNOWN and prior native drain timeout open. Evidence: cascade-contract/atlas-factorization-node.json, section-cache-browser-result.json, section-cache-invalidation-result.json, worker-diagnosis-live.json and worker-diagnosis-native.png.

Next action: continue the FPS repair from measured expensive browser work, especially receiving-water geometry and large RiverScene rerenders. Do not repeat rejected atlas factoring or section caching without new evidence. Preserve full visible water, physics and optics; retain slow-frame evidence for the reported 3 FPS episode. Obtain a fresh explicit quiet-window ACK before a controlled full-scene claim. The completed Pro prefix/energy contract remains the next physical-pace experiment: audit Film API and implement one pressure-bearing receiving face with event-cut substeps and full rollback, never deferred wet-contact physics. Full goal remains 6/33, W06 active, ENERGY_UNKNOWN.

One tracker measures every three.js canvas in Aralia: the toolkit in
`src/devtools/perf/`. It finds each renderer by itself, so a 3D surface needs
no code to be measured. One import at a page entry puts the display on the
page. The display is an fps pill in the lower-right corner; Alt+P cycles it
to the full panel, then off.

Since 2026-09-29 the panel also DIAGNOSES a frame. It says whether the frame
time is only the display's rhythm, what each render pass cost on the CPU and
the GPU, whose triangles they were, what the camera sees, what made each slow
frame slow, which memory counts move, and how a marked reading compares with
the live one. See "What each number means" below.

## Waterfall comparison repair

Residual FPS checkpoint: the original waterfall no longer builds invisible legacy droplet transforms. Impact mist reuses its canonical section and evaluates only the four vertices actually sampled instead of rebuilding all 48 per puff. The full body uses the same extracted deformation formula. Old/new body and mist attributes and instance matrices match exactly at Q=1.5 and Q=12 across six times, and through source closure/reopening at four more times. Warmed high-flow update calls fell from 48.3-57.4 ms to 16.6-25.8 ms; this is a local CPU comparison, not end-to-end FPS. A subsequent 20-second same-camera live Seven Sisters sample with accumulated water averaged 24.9 FPS (19.8-28.3 across one-second readings), spanning physical time 8.008-8.575 s. The source and solver remained running, with 5188 parcels, 83826 surface vertices, no simulation/display error and 0 unresolved surface volume. The tracker now separately measures worker-message reads (24.6 ms mean), water installation (6.8 ms) and controls (0.14 ms); the aggregate includes these phases and must not be added to them. Message access measures lazy browser decoding plus its access overhead, not solver time. Eleven focused dry-tail/secondary-deformation tests pass; scoped types have zero in-scope errors with one existing imported diagnostic suppressed. Ordinary live preview only; no isolated GPU benchmark. Complete runtime, optical and physical acceptance remains open: 6/33, W06 active, ENERGY_UNKNOWN. Proof: cascade-contract/fps-residual-profile.json, fps-mist-parity.json, fps-mist-pulse-parity.json, fps-mist-live.json and fps-mist-live.png.

FPS repair checkpoint: the user reported 3 FPS in the selected Seven Sisters comparison. The live CPU profile attributed the main stall to contact-surface construction and prism qualification in worker-message handling. Scalar arithmetic preserves the previous results; the exact builder and all checks now run in the existing comparison worker, which transfers used geometry buffers to the existing renderer. Hidden diagnostic marker quads are built only when requested. On the retained 7.708 s state (5,188 parcels and 83,826 vertices), the old main-thread rebuild took 311.5 ms; prepared-buffer installation took 3.6-5.8 ms. Every compared geometry attribute and the accounting receipt matched exactly. A subsequent 20-second live sample at the same camera, 8.108-8.650 s physical time and the same parcel/vertex counts averaged 21.5 FPS (12.3-24.5 across one-second readings), with no simulation or display error and zero reported unresolved volume. This is ordinary live-preview evidence, not an isolated GPU benchmark. The tracker now shows between-frame operation mean, p95, worst, frequency and age, ranks measured blockers and labels unaccounted frame time as unknown rather than spare capacity. Worker construction is explicitly labeled off-main-thread. Eighty focused tests pass; scoped types have zero in-scope errors and one pre-existing imported diagnostic suppressed. Remaining main-thread callback and original river snapshot work still exceed the frame budget; comparison physical pacing is still below real time. No realism or physical acceptance gate changed: 6/33, W06 active, ENERGY_UNKNOWN. Proof: cascade-contract/fps-before-profile.json, fps-retained-state.json, fps-packet-parity.json, fps-after-live.json and fps-after-preview.png.

## Evidence summary and measurement limits

The panel starts with a measured budget result or an unresolved pacing result.
It ranks the three most expensive CPU passes. The renderer probe already
subtracts nested children from parent CPU timings. CPU callback time includes
renderer submission and possible
GPU back-pressure. It does not measure worker execution. Slow-frame counts mean
intervals above 33.3 ms in the last second; a whole window above that threshold
is sustained slow pacing, not a series of isolated hitches.

Frame statistics cover one second. CPU and GPU averages cover up to 120 measured
samples, and pass CPU averages cover up to 60 samples. These windows can differ
substantially at low FPS. A stable rhythm is inferred from frame intervals; it
does not prove monitor refresh rate or display waiting. The work reading no
longer assigns residual time to the display. Triangle counts describe submitted
load and do not establish a cause.

Hidden-tab transitions clear timing evidence even when callbacks stop. The first
resumed interval is excluded. Gaps over one second also reset CPU, GPU, pass and
stall evidence. Such gaps may be a suspension or a genuine long blocking task;
use a browser trace to investigate rather than interpreting the excluded gap as
normal visible throughput.

HUD snapshot sampling runs every 250 ms and exposes its elapsed cost. That cost
excludes React rendering and renderer-probe overhead. Scene coverage remains
on request. WebGPU timing uses the toolkit's own timestamp writes on every
physical render/compute pass when the device exposes timestamp-query and no
other timer owns it. Four fixed readback slots resolve asynchronously. A full
pool, a counter reset, conflicting writes or overflow discard whole frames.
The sum excludes uploads, copies, queue gaps and presentation. The installed
three r172 info timestamp path remains unreliable and is never read as GPU duration.

The live river forwards its field-build and edit-patch clocks, solver pace and
latest completed worker utilization window. Utilization divides elapsed slice
time by the actual wall-clock window; it is not hardware CPU usage. Stepping,
field construction, edits and port submission are separate. Window age is
explicit. Snapshot delivery retains the mapper's existing latest-wins and
one-unacknowledged-snapshot contract. The client's bounded snapshot log measures
callback application, ACK submission and handler elapsed time. The view measures
texture queueing, mirror field assignment and geometry rebuilding, including
triangle indexing. Actual upload cost belongs to the renderer probe.

The local wiring remains in gitignored Design Preview RiverScene.tsx. Tracked
client/view/worker APIs hold the telemetry; the preview is not silently force
tracked. The client callback may include handles and React state scheduling, so
its application duration can exceed the view's own total.

Diagnostic overhead now has a bounded, ten-second ledger for renderer probe
bookkeeping, graphics bookkeeping, scene inventory, HUD sampling and React
subtree render duration. Read it through window.__araliaPerfOverhead.snapshot().
The clocks exclude the renderer/upload operation they observe. Very frequent
calls aggregate in 100 ms buckets; window edges have up to 100 ms uncertainty.
These are measured components, not a complete overhead claim: browser layout,
paint, clock calls and the ledger's own recording require an external trace or
tools-on/tools-off comparison. React duration is available in development.

Before/after marks retain the detailed comparison view. Keep camera, surface
size, solver pace and visibility constant, change one variable, and allow the
120-sample window to settle. A single marked window is not a benchmark.

## Active river performance goal

Agora task agora-cb1a, owning chat 01a107ac-dad8-7901-903d-93c774d3645b.
All eight items remain in scope. Instrumentation is not optimization acceptance.
The current waterfall owners are making visual changes in the shared checkout;
comparison requires a frozen source set and the same hydraulic snapshot.

| Item | Current evidence and remaining acceptance |
|---|---|
| 1. Frame attribution | Saved browser CPU profile identifies standing-sheet rebuilding, waterfall mesh animation, renderer submission and uploads. Native WebGPU pass timestamps now work and have rendered proof; a complete browser trace also separates task elapsed time from thread CPU. Queue gaps and presentation remain unmeasured; no residual duration is labeled as waiting. |
| 2. Snapshot and upload measurement | Implemented phase telemetry and bounded client handler log. Live view geometry measured about 30-80 ms; queueing and mirror field assignment near zero. Renderer upload instrumentation remains separate. Timing tests pass. |
| 3. Snapshot optimization | Open. ACK backpressure already exists. Per-face index arrays removed with floater-query tests. Edge sample caching preserves exact native arrays but shows no build-speed benefit; disabled by default. Buffer reuse preserves native output but a replay comparison shows no repeatable gain; remains unused. Receiving refinement is integrated with default OFF. Native geometry, floater, pixel, stale/fallback and actual course-edit checks pass. Live snapshot application falls from about 22 ms to 3 ms; fixed-field replay confirms callback and p95 gains with mixed mean pacing. Default enablement remains open. |
| 4. Reflection optimization | Open. Matrix reuse preserves output within normal one-bit half-float variation but does not improve normal pacing. Experimental setMatrixReuse stays off by default. Integrated ground batching passes warmed native whole/lower/shadow pixel parity and reduces native opaque submissions, with a short controlled first-pair mean gain. Ground defaults remain off pending the owner decision. Preserve existing frustum culling and distant tree stand-ins. |
| 5. Main scene optimization | Open. Integrated ground batching preserves original editing and shadow tiles; warmed native pixels, moving-camera fallback and attribute invalidation pass. Short paired timing favors batching, with final baseline drift recorded below. Default enablement remains open. |
| 6. Solver utilization and lifecycle | Fast mode about 99% elapsed busy, mainly stepping. Paused windows measure zero stepping/fields. Separate work messages prevent stale paused readings. One-pending-slice scheduler fixes resume/edit duplicate chains with race tests. Live five-cycle pause/resume check keeps idle slices at 99 before / 109 after per ~1 s, with zero stepping/fields. The native 900 s safety-cap transition is verified. Four actual worker-role policy tests cover the 45 s minimum, 900 s cap, edit/top-up restart, explicit fast mode and paused edits. Native identity-edit restart now passes with healthy=true and zero restores; no hydraulic equations changed. |
| 7. Tracker overhead | Component clocks implemented and tested. Reversible measurement bypass now suspends probe bookkeeping, graphics clocks, inventory, browser reports and HUD polling; native rendering continues. A full tools-on/off comparison is diagnostic only because of first-pair drift and a possible pre-run source reload; a controlled repeat gives observed bracketed mean overhead of 1.50-2.60 ms for its frozen-field conditions; a universal bound is not claimed. |
| 8. Controlled validation | First frozen-field comparisons complete; performance gains rejected where not demonstrated. Same camera, 1654x968@1, pinned time, paused hydraulics and visible tab. Full improved live-path acceptance remains open. |

Disposable evidence and original source copies are in ignored
.agent/scratch/river-perf-goal/. The baseline CPU profile is exploratory rather
than a controlled before/after run. Focused validation: riverWorkMeter (3),
riverLiveClient (3), perfOverhead (2), rendererProbe (17), perfSession (25): all
50 passed at instrumentation stage. Later river checks total 18 passing tests:
client (4), work meter (3), scheduler races (3), matrix policy (3), receiving
geometry (3), floater triangle queries (2). This is 62 affected checks across
runs; it is not a repository-wide test claim. Subsequent five-file scoped
typecheck also passes with zero in-scope or suppressed errors. No commit or
push requested.

### Native worker and scheduling checkpoint

A real browser module worker runs RiverReceivingRefiner with the current native
half-float fields, water sheet and ownership mask. Its 43,099-vertex output
matches the view path exactly: positions, normals, full triangle indices and
owned standing indices. Only newly created output buffers transfer; the input
buffers remain attached. Three focused parity/ownership/transfer checks and
scoped types pass. The helper now has a default-OFF mapper/client/view integration. Configuration
uses the authoritative view mask, its version and a unique ID across replacement
views and enable transitions. Failed or stale preparation uses the existing
view path. Native routing and parity pass; actual bed-edit invalidation and
controlled live-path performance acceptance remain open.
Cold worker construction took 573 ms; three refinements took 53.8/40.5/38.4 ms
against 32.9 ms in the view. Shared CPU activity makes those diagnostic timings,
not an FPS result. Proof: receiving-worker-proof.json in ignored scratch.

A complete 13.12 s browser trace identifies 44 snapshot callbacks totaling
1,403 ms elapsed / 1,373 ms thread CPU, with a 59.9 ms maximum. The animation
callback wrapper, which includes the native render loop, totals 10,168 ms
elapsed / 9,992 ms thread CPU. That is not probe overhead. Main-thread complete
task intervals occupy 99.7% of the trace after unioning overlaps. Paint totals
85 ms and layout 96 ms; these nested categories are not added to callbacks.
This shared-source diagnostic does not establish a quiet-window throughput
gain or identify GPU/display waiting. It does support optimizing snapshot
application and native rendering rather than labeling residual frame time
as waiting. Proof: browser-trace-complete.json and browser-trace-summary.json.

Small FPS labels now use PerfSession.frameReading, sharing exactly the panel's
frame window and stopped/hidden policy. They no longer allocate full pass,
upload, stall and memory diagnostics. All 31 affected session/inline-HUD checks
and a three-file scoped typecheck pass; the native badge and panel have rendered
proof in lightweight-badge-native.jpg. This removes unnecessary diagnostic
construction, but a complete tools-on/off overhead bound remains open.

Native WebGPU measurement bypass has now been exercised with the pass clock
installed: native frame counts advance while measurement is off, sessions clear,
and fresh GPU samples return after re-enabling. No persistent runtime patch
remains. This proves lifecycle behavior, not the full overhead bound.

Scratch terrain batching reduces ground mesh submissions substantially, but
rendered acceptance fails at small edge differences. The first throughput run
also preceded an index-attribute correction, so it cannot establish an accepted
gain. Exact single-tile clones reproduce baseline variation; combining tiles
still changes some rendered edge channels. No batching is installed. Preserve
native terrain ownership, culling, editing and shadows when investigating draw
order. Proof: terrain-comparison.json, terrain-quality-repeat.json and
terrain-single-clone.json. Parent owns current Scene edits through Agora.

Shared cliff boundary-light preparation was observed stalling startup. Its
owner moved preparation into a worker; that change requires its own native
readiness and realism proof. It is separate from receiving-sheet refinement.
The original river tab is responsive again, with normal solver/render/measurement
settings restored and the temporary recovery tab closed. Failed or reloading
captures are excluded from FPS comparisons.

### Quiet overhead, batching parity and auto-pace follow-up

The next full-tools on/off/on/off/on comparison keeps camera [45, 185, 92],
drawing buffer 1654x968 at DPR 1, one native field, time 10 and visible tab fixed.
Eight-second runs record mean 38.70 / 34.62 / 35.75 / 34.42 / 36.10 ms,
p95 51.0 / 45.6 / 45.1 / 46.5 / 47.9 ms and 159 / 117 / 131 / 113 / 127 intervals over 33.3 ms.
Frame counts are 208 / 233 / 224 / 234 / 223; measured sessions are 1 / 0 / 1 / 0 / 1.
The last on means differ by 0.35 ms and the off means by 0.20 ms. Bracketing
paired mean differences are 2.60 ms and 1.50 ms. This gives an observed overhead
range for these conditions, not a universal maximum or a guaranteed FPS gain.
The first on run is still slower than later on runs. No report attributes the
whole difference to one component or adds overlapping clocks.

The benchmark exceeded its requested quiet-window deadline. Passive pause
samples bound the actual overhead interval to about 06:20:22-06:21:14 local.
Agora receipt 3901 independently attests no parent GPU, heavy CPU or renderer
source work through 06:21:14. Thus parent work did not contest these samples.
Future runs must record exact start/end UTC in the script; prompt receipt and
model-side completion polling proved too slow for a strict short deadline.
Proof: overhead-repeat-with-settling.json in ignored scratch.

A two-second scratch quality experiment merges consecutive native depth-sorted
ground meshes separately for main and reflection cameras. It uses original
frustum spheres before merging, retains primitive order and native attributes,
and renders only 105 batch meshes instead of 842 originals. All repeated/cross
mode comparisons vary by at most one half-float bit with zero channels over
two bits, consistent with baseline variation. No batching is installed. Fixed
camera parity does not prove a normal-frame FPS gain, camera movement, bed-edit
invalidation or shadow rebaking. Proof: terrain-depth-proof.json.

A passive native observation follows auto pace from 461.67 s to 904.38 s of flow,
including temporary benchmark pauses. Fast mode stops at 900.27 s, the unchanged
900 s safety cap. Outflow 1.855 m3/s against inflow 1.5 m3/s remains outside the 5%
threshold; this is a capped transition, not hydraulic settling. Five sampled
seconds remain in auto real-time mode; the final rate is 1.013x with zero restores
and healthy=true. Worker elapsed busy drops from about 99% to 63.5%, with separate
stepping/field clocks. The bounded observer stops itself. This does not yet
verify an identity edit restarting fast mode or the minimum 45 s settling branch.
Proof: auto-settling-observation.json.

Four focused riverWorkerPace tests now drive the actual worker controller with
staged field clocks. They verify matching outflow cannot stop fast mode before
45 s; an unsettled field stops at 900 s; identity edits and top-ups reset the
minimum; explicit fast mode overrides settlement; and paused edits restart the
policy while stepping waits for resume. The scoped test typecheck reports zero
in-scope or imported errors. Hydraulic stepping is a fixture, so these are
controller-policy tests, not evidence that a real river has hydraulically
settled. Native identity-edit restart is verified in the later live edit receipt below. No worker controller
or solver equations changed for these tests.


The receiving integration is now applied with the worker path OFF by default.
Fourteen focused mapper/client/refiner checks pass. A six-file implementation
typecheck and separate two-test-file typecheck each report zero in-scope or
imported errors. Mapper fixtures prove latest-wins, accumulated field time,
one-unacknowledged snapshot, ownership replacement, transfer safety and base
delivery after constructor/refinement failure. They do not prove hydraulic
numerical equivalence; the existing solver equations are unchanged.

The actual native mapper route was exercised at UTC 04:52:33.929-04:52:36.673
in an Agora correctness window. It produced 43,175 vertices. Position, normal,
full indices, standing indices and landing indices match the existing view
path exactly; all six floater placements match. Original field/sheet/mask
buffers remain attached. A repeated baseline changes 1,243 half-float channels
by one bit; cross-route output changes 1,192, also by at most one bit and with
zero changes over two bits. Disable/re-enable rejects the old packet; stale
and failed preparation rebuild the exact native fallback. No browser errors
were recorded. The run restored worker OFF, normal rendering and unpaused
hydraulics. Proof: receiving-native-proof.json and receiving-native-proof.jpg.
This establishes correctness for one native snapshot, not live FPS improvement
or actual bed-edit acceptance. Default enablement remains gated by those checks.

### Native receiving improvement and edit acceptance

A receipt-based Agora freeze keeps other GPU, heavy CPU and source work out
of five native auto real-time runs. Camera [45, 185, 92], drawing buffer
1654x968 at DPR 1 and animation time 10 are fixed; hydraulic fields evolve.
OFF/ON/OFF/ON/OFF mean frame times are 29.19 / 27.70 / 30.16 / 27.73 / 31.24 ms;
p95 is 51.4 / 38.0 / 53.0 / 37.0 / 55.2 ms. Intervals over 33.3 ms are
37 / 37 / 44 / 30 / 54 out of 274 / 290 / 266 / 289 / 257 intervals.
Main snapshot application falls from 21-22 ms to about 3 ms. All 64 candidate
snapshots use matching preparation with zero refinement errors. Bracketed
mean improvements are 1.97 and 2.97 ms; the evolving field and baseline drift
remain explicit limits. Identical-field timing and final owner acceptance
still gate default enablement. Proof: receiving-live-benchmark.json.

Native identity edit restarts auto fast mode from a capped real-time state.
A reversible 0.1 m course edit increments mask version 1 to 2; restoring the
original edit increments it to 3. Both changes use new IDs. The actual Scene
rejects the old preparation and receives matching preparation after restore.
Edit state is restored exactly, healthy=true and restores=0. Worker OFF,
handlers, camera, drawing size, animation and pause settings are restored;
auto remains fast because the identity edit intentionally restarts settling.
Actual work spans UTC06:18:21.983-06:19:38.937. Command/pickup time made the
start-ACK-to-completion interval exceed the initial 90 s estimate. Agora3997
confirms the explicit-release hold still excluded competing work. The window
was released before analysis. Proof: receiving-edit-proof.json.

### Terrain submissions and optional helper

The corrected depth-order batching experiment has a five-run normal-frame
comparison at the current side camera and1353x726, with a fixed native field.
Reflection draws fall266 to68, CPU about4.1 to1.2 ms; main draws fall125 to48,
CPU about2.2 to0.75 ms. Submitted triangle counts match. Means stay near16.7 ms
because both modes reach the60 FPS floor; p95 is20.3/19.6/20.5/19.2/20.4 ms.
Cross-mode pixels differ by at most one half-float bit, with zero changes over
two bits. This proves lower submission CPU under these conditions, not a live
FPS increase. Actual UTC05:57:18.695-05:58:08.820; restored before the sampling
deadline. Proof: terrain-depth-benchmark.json. This camera/size differs from
the original low-FPS view and is not compared directly against that view.

RiverGroundBatch is integrated in the Scene with default OFF, with six focused checks
and a two-file scoped typecheck reporting zero errors. It retains original
tiles for editing/shadows, uses native frustum membership and primitive order,
falls back while cameras move or preparation is incomplete, invalidates edited
attribute versions, and restores the canonical Scene array even on failure.
Shadow refresh and unsupported shared-material/transform layouts stay native.
Preparation uses a soft1 ms budget with one bounded group finishing first.
The reviewed ground-batch-proposal/integration.patch is applied. Actual Scene and helper scoped typechecks report zero in-scope and imported errors. The Scene and helper are returned to their owner for one dependency-header wave.
Native camera/edit/shadow/pacing acceptance remains open; no batching is enabled.


### Current frozen receiving and integrated terrain checks

The receiving replay holds one native field, camera [45,185,92], water time10,
1654x968 drawing buffer, visibility and paused hydraulic solver constant.
It replays that field at4Hz through the native callback, actual refiner and
native transfer list. Five8s OFF/ON/OFF/ON/OFF samples ran from07:11:30.530
through07:12:26.212 UTC in the Agora source/CPU/GPU hold. This is replay
acceptance, separately supported by the earlier actual live-mapper receipt.

Mean frame times were26.97/29.74/27.44/25.87/26.89ms; p95 was
49.8/42.8/51.7/37.7/49.3ms. Samples297/269/292/310/298 had
35/71/35/42/33 intervals over33.3ms. All runs received32 snapshots; both
enabled runs matched32 prepared configurations. Mean application time was
20.90/3.15/21.61/3.01/20.25ms. Every adjacent pixel comparison differed by
at most one half-float bit, with zero differences greater than two bits.
Input buffers remained attached and controls were restored. The current user
surface was1924x985 and was restored; it is not the benchmark surface.
Proof: receiving-frozen-benchmark.json in ignored river-perf-goal scratch.

This verifies main-thread callback reduction and repeatable p95 improvement.
Mean frame performance is mixed and over33.3ms interval counts increase in
the enabled samples. It does not establish a blanket FPS or pacing benefit.
Receiving remains default OFF pending the combined acceptance decision.

The first actual integrated ground check ran07:15:44.955–07:15:53.278 UTC.
Moving-camera and terrain-version changes fall back to canonical original
tiles; invalidation and restoration pass. Eight native shadow-render calls
each retain all842 original terrain casters. Lower-river pixels match exactly
before shadow refresh. The first whole-river and post-shadow AB comparisons
change significantly, while switching back after preparation matches the
batched image within native noise. This initial comparison is not visual
acceptance; a warmed native comparison is required to distinguish preparation
state changes from a batch regression. The baseline receipt is preserved in
ground-native-first-proof.json; source and defaults are unchanged. A repeat
warms both geometry paths before comparing and records exposure on each side.
All temporary controls and source attributes were restored before release.

The earlier browser still held a pre-ground View. Actual readiness now checks
setGroundBatch exists on the current View after the coordinated source freeze.
Source writes triggered repeated Vite full reloads; no timing is accepted
across a View replacement. Ground and combined normal-frame gates remain open.


### Warmed native terrain and final short comparisons

The warmed integrated ground repeat passes: whole-river AA/AB/BB/BA differ
by at most one half-float bit; original lower-river, shadow-refresh and restored
terrain comparisons are exact. Exposure is identical on both sides:0.662533
for the whole river and0.917224 for the lower river. Moving-camera and source
attribute-version invalidation use original tiles and restore the canonical
children array. Native shadow priming retains842 original terrain casters.
The first mismatch above was not repeated after warming both paths. This
accepts pixel parity for these tested states; it does not attribute the initial
mismatch to a specific subsystem. Proof: ground-native-proof.json.

Final paired comparisons use five4s samples each, keeping source/API,
camera [45,185,92],1654x968 buffer, pinned time10, visibility and paused
hydraulics fixed within each comparison. Source, numeric fixture builds and
other GPU proof remained held through explicit restoration and release.

Ground alone: mean36.79/33.73/37.43/34.35/46.24ms; p95
46.3/41.9/46.6/41.2/68.5ms. Samples108/118/107/116/87 had
78/61/83/77/85 intervals over33.3ms. The first bracket improves mean
by3.37ms, about9.1%, with lower p95. The final native baseline drifts and
has a169.8ms p99, so the second bracket is weaker evidence. The earlier
normal-frame prototype also reduces reflection submissions266→68 and
main submissions125→48 without changing triangles, at a different camera.

Combined ground plus receiving replay: mean63.99/43.07/54.86/23.35/39.54ms;
p95110.6/119.4/91.4/37.8/65.1ms. Samples62/91/73/171/101 had
53/38/72/16/61 intervals over33.3ms. Adjacent pixel comparisons remain
within one half-float bit. Mean favors the enabled modes, but the first
enabled p95 worsens and baseline drift/long outliers are substantial. Four
seconds does not establish a universal FPS bound or stable tail behavior.
The outlier cause is unmeasured in this run; it is not labeled garbage
collection. Proof: ground-final-benchmark.json and combined-final-benchmark.json.

Actual scripts ran07:23:57.619–07:24:30.455 and07:25:03.192–07:25:38.234
UTC. The span including the inter-script gap is100.615s, exceeding the100s
planned GPU interval by0.615s; preparation and release receipts add time.
No within100s claim is made. Independent parent hold receipts exclude
source/build/GPU interference through release. Controls restore each script's
initial user pose and surface; those differ between comparisons, so no
cross-comparison baseline equivalence is claimed. Both comparisons restore
default-OFF behavior. Ground/default receiving decisions are returned to the
source owner through Agora; final acceptance remains open.

The goal is currently blocked pending source-owner default acceptance and
current-source verification. The owner kept defaults OFF during water-quality
proof (Agora4062). Flood, receiving-mask seam and waterfall changes followed
these captures. Saved timing and parity receipts apply to their frozen tested
version, not automatically to the later source. On resume, verify the current
Scene, reacquire exact Agora identity/locks and coordinate a new source/GPU
freeze before accepting defaults. No optimization source edits or GPU work
were performed while recording this blocked checkpoint.

### Frozen-field comparison evidence

Agora coordinated a full source freeze and closed the other GPU proof tab.
The snapshot stays fixed during measurements, camera at [45,185,92], water
animation time 10, drawing buffer 1654x968@1. Queued field application was
temporarily held for the benchmark and restored afterward; the solver and
normal water animation were resumed. No persistent runtime patches remain.

| Experiment | Before A | Candidate B | Before A repeated | Decision |
|---|---|---|---|---|
| Standing geometry, 12 builds each, mean / p95 ms | 26.41 / 29.90 | 26.88 / 31.40 | 26.78 / 30.30 | Field-sample cache does not improve this native 42,972-vertex fixture; default off. |
| Matrix reuse, normal 8 s runs, mean / p95 ms | 32.9 / 41.0 | 33.3 / 43.0 | 32.1 / 40.8 | No demonstrated normal-pacing gain; default off. |
| Matrix reuse, GPU-drained 80-frame runs, mean / p95 ms | 60.92 / 75.30 | 59.21 / 73.70 | 60.47 / 72.90 | Slightly lower drained elapsed time does not establish an FPS gain or GPU duration. |

Normal runs recorded 245/242/251 frames; 111/110/85 exceeded 33.3 ms.
Draw counts and triangles matched at 985 / 19,372,144. Original/cached geometry
positions, normals, full indices and owned standing indices matched exactly.
Rendered half-float channels changed by at most one bit: A-to-A 1,179,
A-to-B 1,113, B-to-B 1,329 of 6,404,288 channels. Cross-mode differences were
smaller than repeated same-mode variation. This supports preserved output,
not exact deterministic pixel equality.

The low-FPS issue remains unresolved as a complete optimization goal. A
paused, fixed field approaches 30 FPS in this comparison, while the live
fast-settling run was about 14-16 FPS. That contrast combines snapshot costs,
solver contention and changed work; it does not isolate any one of them.
Next controlled experiments should separate worker contention from snapshot
application, then optimize the proven cost without lowering visual quality.
Full browser/tool overhead and automatic settling acceptance also remain open.
Targeted MemPalace mining is deferred while this performance goal remains active.

Proof: ignored matrix-benchmark.json, combined-comparison.json and scheduler-lifecycle.json under
.agent/scratch/river-perf-goal/. A failed source-reload capture was discarded.

### Worker and snapshot isolation checkpoint

A later visible-tab experiment held the native field, camera [45,185,92],
animation time 10 and drawing buffer 1654x1036@1 constant. Five eight-second
runs recorded paused / fast worker without snapshot application / paused /
same-snapshot replay at 2 Hz / paused. Mean frame times were 38.4 / 49.5 /
38.7 / 38.0 / 36.3 ms; p95 was 50.2 / 61.0 / 48.9 / 58.3 / 50.8 ms.
Draw counts and triangles matched throughout at 948 / 18,219,369. Native
snapshot replay rebuilt geometry in about 32 ms and produced timer-attributed
slow frames. Other agents reported concurrent CPU checks, so this run is
preliminary and does not meet the quiet-window causal acceptance gate.

Proof: ignored isolation-comparison.json. Its message-count field is invalid:
the bounded log was full, so subtracting lengths reported zero. The disposable
experiment now counts timestamped entries instead; production logging was
already bounded correctly. Temporary application overrides, solver pace and
animation controls were restored. No runtime patch remains.

The restored automatic solver was observed at 1,239.97 s, fast=false,
rate 0.986, healthy=true, with 409.9 ms stepping and 68.1 ms field construction
in a 1,001.8 ms window. This confirms a real-time endpoint; an edit-to-settled
transition still needs an explicit lifecycle receipt.

### Further frozen-field and diagnostic checks

A repeated quiet window with no other GPU tab or solver/fixture run held the
field, camera, animation time and 1654x1036@1 buffer fixed. Paused / fast worker
without snapshot application / paused / 2 Hz same-snapshot replay / paused
gave mean frame times 32.6 / 44.8 / 43.0 / 42.6 / 34.2 ms and p95
43.8 / 60.0 / 56.9 / 60.4 / 42.3 ms. The middle paused run included a 457 ms
outlier. Counts matched at 948 draws and 18,218,083 triangles. Fast mode
delivered 29 acknowledged snapshots while their application was held and
reported 99.5% elapsed busy. Baseline drift and outliers limit a precise
causal split; this is not an accepted optimization result.

An exterior-displacement sampling candidate used the existing ownership bounds.
Its native 42,070-vertex output matched positions, normals, full indices and
owned indices exactly. Four sets of 18 builds measured mean / p95 ms:
original 19.38 / 23.30, bounded 18.29 / 21.00, original 19.94 / 26.90,
bounded 19.81 / 26.90. The gain was not consistent, so the production path
was not changed. Proof: ignored quiet-isolation-comparison.json.

The unused riverGeometryBuffers.ts experiment retains native attribute/GPU
buffer identities only when every attribute and index has a matching layout,
type and capacity. It adopts exact new arrays without another copy, skips
uploads for unchanged arrays, and falls back atomically when wet topology needs
different capacity. Four focused tests and a two-file scoped typecheck pass.
It is not wired into production and has no accepted FPS benefit yet.

For a full overhead comparison, window.__araliaPerf.setMeasurementEnabled(false)
suspends automatic probe sessions, GPU queries, browser long-frame observation,
inventory scans, graphics clocks and HUD/badge polling. Scene draws, uploads
and solver messages still run. Restore with setMeasurementEnabled(true), and
read measurementEnabled(). This does not persist a preference. Panel mode and
comparison marks remain; automatic timing sessions restart fresh. Installed
wrappers retain one cheap bypass condition, so an A/B result measures active
diagnostic overhead rather than the cost of loading no toolkit at all.

Rendered bypass proof: native frames advanced from 2,949 to 3,298 over 18.09 s,
camera and paused=false unchanged, measured sessions absent. Re-enabling
restored the live panel and badge. This verifies bypass behavior, not an FPS
gain: hydraulics advanced during that check. Proof: ignored bypass-lifecycle.json,
bypass-off.jpg and bypass-restored.jpg. The focused bypass wave passes renderer
(19), overhead ledger (2), control (1), inline FPS (5) and overlay host (4)
checks across runs, with seven implementation files reporting zero scoped or
suppressed type errors. A fake performance clock initially made the inline
fixture appear stopped; the fixture now fakes only interval scheduling.

A browser trace collected during shared GPU activity lost older CDP event
chunks. The saved browser-trace-partial.json explicitly records truncation;
it cannot establish complete overhead or scheduling attribution. A shorter
streamed trace or the controlled bypass comparison is still required.

### Native GPU clock and further comparisons

The toolkit now supplies its own physical-pass WebGPU timestamps instead of
reading r172 renderer.info. Five focused clock tests cover aggregation, delayed
readback/pool pressure, partial-frame rejection, ownership/disposal and failed
resource allocation. Together with 19 probe checks, all 24 pass; the two
implementation files report zero scoped or suppressed type errors. Native
rendered proof collected 120 GPU samples without validation errors: pass sum
14.49 ms mean / 14.81 p95, alongside 45.72 ms CPU callback elapsed. Reflection
was 18.20 ms CPU / 2.96 ms GPU with 610 draws; main scene 10.42 / 10.15 ms
with 327 draws. This live snapshot is diagnostic, not isolated causal proof.
The GPU sum omits work outside passes; CPU and GPU may overlap. Proof:
ignored native-gpu-clock.json and native-gpu-clock.jpg.

A quiet native snapshot replay used eight snapshots, 2 Hz application, the
same camera and 1654x968 surface. Original/reuse/original/reuse eight-second
runs measured mean 40.6 / 37.5 / 35.4 / 36.9 ms and p95
60.0 / 56.0 / 53.0 / 56.5 ms. Application means stayed about 25-26 ms.
Twelve of sixteen replacements reused compatible layouts in each candidate
run. Positions, normals and indices remained exact native arrays. Half-float
pixel differences were AA 457 / AB 306 / BB 457 of 6,404,288 channels,
maximum one bit. The benefit was not consistent, so buffer reuse is unused.
Proof: ignored buffer-comparison.json.

A separate completed-native-frame observer measured tools on/off/on/off at
the same camera, frozen field and 1654x968 buffer: mean
39.70 / 32.89 / 33.79 / 33.27 ms, p95 53.6 / 45.3 / 44.1 / 42.7 ms.
Sessions were 1 / 0 / 1 / 0, verifying the bypass. The first pair drifted
substantially, and another owner reported a pre-run material write. The
later 0.52 ms mean difference is not a deterministic overhead bound. A
repeat after warmup is still needed. Proof: ignored overhead-comparison.json.

Main-scene inspection found 842 non-instanced ground tiles and 51 rock tiles.
A temporary 48/72 m grouping benchmark is prepared in scratch; no terrain
batching change has been accepted or applied to production.

## How it works now

### The renderer probe

`rendererProbe.ts` wraps the calls that every surface must make:
`renderer.render`, `renderAsync`, `compute` and `computeAsync`. It finds a
renderer by three routes:

1. A `WebGLRenderer` dispatches an `observe` event on
   `window.__THREE_DEVTOOLS__` when it is built. The probe listens for it.
2. A `WebGPURenderer` asks a canvas for a `webgpu` context. The probe watches
   `getContext`, then wraps the class that `three/webgpu` exports.
3. `instrumentRenderer(renderer, { id, label })` wraps a renderer that is
   handed in. `PerfProbe` calls it with the R3F `gl`.

A frame is every renderer call made in one display frame. The browser gives
every animation-frame callback of one display frame the same timestamp, and
the probe uses that timestamp as the frame key. A call outside a callback
(a timer, an `await` that resumed) joins the last frame if that frame started
less than 50 ms before. With no animation frame at all, one task is one frame.

The probe reads the renderer counters before and after each call and adds
the difference. It never changes `renderer.info.autoReset`. So it counts every
pass of a post-processed frame, and a scene that reads `gl.info` itself still
reads three's own numbers.

CPU time runs from the top of the animation-frame callback to the end of that
callback (until 2026-09-29 evening it stopped at the last renderer call, and
missed the page's script after the last draw). GPU time on WebGL comes from
`EXT_disjoint_timer_query_webgl2`, one query SEGMENT per pass
(`PassGpuTimer` in `gpuTimer.ts`): a pass ends its segment when it returns, and
a nested pass (a shadow map) ends its parent's segment and resumes it after,
because only one query may be open. The frame's GPU time is the sum of the
segments; GPU work between two passes is not in it.

Every render and compute call is kept as a named PASS, nested passes
included. The probe also wraps the graphics API calls that upload data,
compile shaders, or wait for the GPU, and files their time per frame.

### The staple import

`import './devtools/perf/staple';` at the top of a page entry installs the
probe and mounts the display. It must come before the page's own components,
because the probe cannot find a renderer that was built before it. These
entries have it:

| Page | Entry | Notes |
|---|---|---|
| Design Preview (`misc/design.html`) | `src/design-preview.tsx` | Also mounts `<PerfOverlay />` in `DesignPreviewPage.tsx`; the root is shared and counted. |
| Game (only while dev mode is on) | `src/App.tsx` | `installPerfAutoProbe()` at module scope under `import.meta.env.DEV`; `<PerfOverlay />` mounts only while `gameState.isDevModeEnabled` is true. |
| Building Identity Lab (`misc/building-identity-lab.html`) | `src/building-identity-lab.tsx` | Had no display before 2026-09-29. |
| Character Atelier (`misc/character-atelier.html`) | `src/devtools/characterAtelier/main.tsx` | Had no display and no probe before 2026-09-29. |

**One template (Remy, 2026-09-30, question sheet q1).** Every page reads the
same module, so a change to `src/devtools/perf/` reaches every 3D renderer on
the next page load. Do not copy the tracker into a page, and do not add a
private frame counter to a HUD: show `<PerfFpsText>` instead. The main game
shows the tracker only while dev mode is on. Dev mode starts on in a dev build
and off in a production build; the Developer Menu control
`SET_DEV_MODE_ENABLED` turns it either way. Proof: the pill shows with dev
mode on, goes away after "Disable Dev Mode", and comes back after "Enable Dev
Mode" (`.agent/scratch/perf-diagnose/devModeGate.mjs`).

A production game build does not install the probe at module scope. The
probe installs when the overlay mounts, so after dev mode comes on it finds
only the renderers built after that. A `PerfProbe` still measures its own
canvas (World3DScene has one), because `instrumentRenderer` wraps that one
renderer without the page-wide hooks.

### The display

- **The pill** shows the fps of the first surface that is drawing. With more
  than one, it adds the surface name and a count.
- **The panel** (Alt+P) shows fps, mean, p95 and worst frame time, a frame
  graph, GPU and CPU time, a bottleneck verdict, draw calls, triangles, lines,
  points, render passes, compute calls, memory, surface size, spans, surface
  readings and the slow-frame log. It has one tab for each surface.
- **The window badge** (`PerfWindowBadge.tsx`) shows the fps of the canvas
  inside a Design Preview window, in that window's title bar. A window with no
  measured canvas shows nothing. A click opens the panel on that surface.
- **`PerfFpsText`** is the fps as inline text, for a HUD. It reads the named
  session, or the session in the same window. The Debug HUD, the fluid HUDs,
  the entity debugger HUDs and the WebGPU probe badge use it.

The badge and `PerfFpsText` never call `setState`. They write into the DOM
from a timer. A timer that re-rendered the page's own React root once starved
a heavy Suspense render forever (see `PerfOverlayHost.tsx`).

### Names

| How | Where | Effect |
|---|---|---|
| `<PerfProbe id="x" label="X" />` | Inside an R3F `<Canvas>` | Stable id `x`. |
| `instrumentRenderer(renderer, { id, label })` | A raw loop | Stable id; release on teardown. |
| `data-perf-id` and `data-perf-label` | Any element around the canvas | Stable id with no script. |
| Nothing | - | Id `auto:<slug>`, labeled by the WindowFrame title, else `?step=`, else the page title. |

### Surface readings

A surface puts its own numbers beside the frame times:

- `session.span(name, ms)` for a time per frame. Spans also feed the slow-frame log.
- `session.setStat(name, value)` for any other number, such as a cell count.

Get the session with `getPerfSession(id)` or `perfSessionForRenderer(renderer)`.

### The headless contract

`window.__araliaPerf` is the capture-rig interface. It keeps its 2026-08
shape: `ids()`, `snapshots()`, `report(id)`, `record(id)`, `stop(id)`. It adds
`open(id)`, `longFrames()` (the browser's long-frame reports the probe holds)
and `scenes(id)` (the live scenes and cameras a surface drew lately, for use
inside `page.evaluate`). A snapshot adds `origin`, `stats`,
`counters.renderCalls`, `passes`, `passGpuNote`, `vsync`, `costs`, `cpuParts`,
`memory` and `inventory`. `report()` carries the whole diagnosis as text. The
container id `aralia-perf-hud-root` is unchanged.

### What it cannot measure

| Gap | Why | Tracked |
|---|---|---|
| GPU time on WebGPU, per frame or per pass | three r172 timestamp queries record only the first pass, so every later reading is the same constant. | GG-334 |
| GPU work between two WebGL passes | The per-pass queries cover the passes, not the gaps. | GG-358 |
| The screen share on WebGPU | The ID render swaps WebGL materials only. | GG-355 |
| The cause of a slow frame under 50 ms outside the frame callback | Chrome writes a Long Animation Frame report only above 50 ms. | GG-356 |
| A garbage collection's time; any GC in default Chrome | Seen only as a heap fall, and default Chrome rounds the heap reading. | GG-357 |
| A canvas not drawn by three (Pixi battle board, dice) | The probe wraps three's renderer, not the GL context. | GG-336 |
| A `WebGPURenderer` on its WebGL2 fallback, with no `PerfProbe` | That backend asks for `webgl2`, so route 2 never sees it. | GG-337 |
| A renderer built before the probe was installed | There is no event to catch after the fact. | Staple import order |
| A worker or `OffscreenCanvas` renderer | The probe runs on the main thread. | - |

### Capture GIF (2026-10-10)

The bottom row of the panel holds one button, **capture GIF** (Remy, 2026-10-10:
"add a 'capture GIF' menu button at the bottom of the FPS tracker"). It records the
active session's canvas for 5 s at 10 fps, at most 480 px wide, into a GIF that the
browser downloads as `<surface>-<time>.gif`. The code is `src/devtools/perf/perfGif.ts`:
each tick draws the canvas into an offscreen 2D canvas (a WebGL or WebGPU canvas keeps its
last presented frame, so the draw reads it), quantizes the frame to 256 colors with a
median-cut palette of its own, and writes it with the GIF89a LZW encoder in that file; no
library. The button shows the frame count while it runs, then the file size. A wall-clock
cap of three times the asked length ends a capture on a page whose main thread is busy
(a shader build, a hidden tab), with the frames it has. It is not a measurement: the
readback and the quantization run on the main thread, so the frame times during a
capture are not a reading of the scene. Test: `__tests__/perfGif.test.ts` (the container,
the palette, and an LZW round trip).

The panel retains the latest completed GIF behind **Save GIF** until a new capture
replaces it or the panel is removed. Recording still requests an automatic download,
but the status says **download requested**, not **saved**: the page cannot certify a
browser filesystem write. The retained link lets the user retry without recording
again. Completed captures after panel teardown do not allocate retained URLs.

In-app browser verification observed canceled downloads with zero bytes for both
the automatic request and an ordinary automation-driven Save GIF click. The supported
browser download operation then wrote the same 4,567,652-byte GIF89a (480 x 370) to
the user's Windows Downloads folder. This proves explicit delivery, not a permanent
repair of the browser's automatic-download handling. Scoped typecheck passed with
zero errors and independent source review passed. Receipts live in ignored
`.agent/scratch/gif-download-repair/`. The GIF encoder and water runtime were unchanged.

## What each number means (the diagnosis)

Remy opened the panel on the river on 2026-09-29 and saw "58 fps, 17.2 ms,
GPU 11.27, CPU 8.38, mixed, 7 renders per frame, slow frames outside the
measured frame". He asked what would make it more indicative. The panel now
answers, top to bottom:

**1. The inferred rhythm.** The yellow rhythm line means most intervals
land on multiples of a known pacing interval. Frame timing alone cannot
prove display refresh or separate scheduling from rendering cost
(memory note: vsync-floor-hides-render-cost). Below it:

- **work** is the LONGER of GPU and CPU. The two sides overlap (the CPU builds
  frame N+1 while the GPU draws frame N), so their sum is not a throughput measurement. The largest measured side
  is not proof of a limiting resource.
  "in series" is the sum, shown only as the cost if they could not overlap.
- **wait** is unavailable. Residual time cannot be attributed to the display from these timers.
- **headroom** is the budget minus the work, in ms and in percent. On WebGPU it
  says "CPU side only", because the GPU side is not measured.

The rhythm is the known refresh rate that most frames land on once; it is kept
while frames stay on its multiples (a 60 Hz page that drops to 30 fps reads
"2 refreshes a frame"). A page that has only ever run at 30 fps on a 60 Hz
display reads as 30 Hz: the panel names a rhythm, not the monitor.

**5. The budget.** "budget display | 60 | 30" in the header picks what the
headroom and the passes are judged against: the page's own rhythm, 16.7 ms or
33.3 ms. The graph draws it as a dashed amber line.

**2. Passes** (tab). Each render and compute call, in the order it ran, with
its own CPU ms (its children and its uploads taken out), GPU ms (WebGL), its
triangles, and a bar for its share of the budget. A pass inside another is
indented (a shadow map). A pass that runs only some frames says so ("·12%").
"all passes" sums them. A pass is named, in this order, by:

1. `userData.perfPass` on the scene, the camera or the render target;
2. otherwise "scene → target": the scene is its `name`, a single child's
   `userData.perfGroup` or name, "fullscreen quad", its kind ("Mesh · Shader ·
   Sphere"), or "N objects"; the target is "screen", its texture's `name`, or its
   size against the canvas ("½ target", "full target #2").

**3. Groups** (tab). Triangles by the scene's own groups: the nearest
`userData.perfGroup` tag on the object or an ancestor, else its name, else a
named ancestor, else "unnamed". The unnamed row is split by kind, material and
geometry, so it still points somewhere. The walk runs once a second between
frames and prints its own cost.

**6. View** (tab). For each scene, judged through the camera that drew the most
passes (the eye, not the mirror): triangles mounted, in view (inside the
camera's frustum, by bounding sphere, as three culls), and drawn. "the cull
leaves out N%". "nearest water" is the distance to the world-space box of a
group whose name says water. "measure" draws the view once into a 192-pixel
target with one flat color per group and counts the pixels: the visible share
of the screen per group (WebGL only).

**4. Causes** (tab). "where the CPU goes" lists the frame's CPU parts, which
add up: the page's script before the first draw, between draws and after the
last draw; each pass's draw submission; texture and buffer uploads; shader
compiles; and "GPU readback (the CPU waits)" (`readPixels`, `getBufferSubData`,
`finish`, `clientWaitSync`). "uploads and compiles" sums them over 1 s and 10 s.
Each slow frame lists what moved against its normal. Parts named "browser: …"
come from Chrome's Long Animation Frame report (style and layout, "React work",
"another animation-frame callback", a timer by its function and file). A note
such as "heap fell 39 MB (a garbage collection)" or "+3 shader programs" has no
time. "outside the measured frame" and "unattributed CPU" remain only for time
no measurement explains.

**7. Memory** (tab). Geometries, textures, programs and heap: now, the change
over the last second, and the mean change a second over ten seconds. A count
that grew in every one of ten seconds is marked "growing". The tab says when
the heap reading is too coarse to show a GC (Chrome without
`--enable-precise-memory-info`).

**8. Compare** (tab). "mark" saves the numbers as a column; the tab shows the
marked and the live values side by side with the delta, green for better and
red for worse, for the frame, GPU, CPU, the longer side, counts and each pass
that ran in both. The A/B rule is printed under it: alternate A B A B with vsync
off in the same minutes, and a number on the 16.7 or 33.3 ms floor is a lower
bound, not a cost.

### Naming a scene for the panel

A surface names its passes and groups with one line each. Names only; nothing
renders differently.

```ts
scene.name = 'river';                          // passes read "river → …"
renderTarget.texture.name = 'reflection';      // passes read "… → reflection"
mesh.userData.perfGroup = 'water';             // groups, view and screen share read "water"
scene.userData.perfPass = 'mirror pass';       // names the pass outright
```

The river and the ocean name nothing today. `.agent/scratch/perf-diagnose/nameWaterPasses.patch.mjs`
adds the names in `riverReachScene.ts` (ground, boulders, stones, vegetation,
floaters, water, sky, post; targets reflection, opaque, water composite) and in
`SideBySideOcean.tsx` (water, sky). Their owners run it (GG-352). The same
edits, for a reader without the script:

| File | After this line | Add |
|---|---|---|
| `riverReachScene.ts` | `const m = new THREE.Mesh(g, this.bankMat);` (ground tiles) | `m.userData.perfGroup = 'ground';` |
| `riverReachScene.ts` | `const rocks = new THREE.Mesh(g, this.bankMat);` | `rocks.userData.perfGroup = 'boulders';` |
| `riverReachScene.ts` | before `this.scene.add(stones)` and `this.scene.add(mixedStones)` | `stones.userData.perfGroup = 'stones';` (and the same for `mixedStones`) |
| `riverReachScene.ts` | before `this.scene.add(veg.group)` | `veg.group.userData.perfGroup = 'vegetation';` |
| `riverReachScene.ts` | `this.floaters.group.visible = false;` | `this.floaters.group.userData.perfGroup = 'floaters';` |
| `riverReachScene.ts` | before `this.skyScene.add(this.sky)` | `this.sky.userData.perfGroup = 'sky'; this.scene.name = 'river';` |
| `riverReachScene.ts` | before `this.waterScene.add(this.water)` / `this.quadScene.add(this.quad)` | `this.water.userData.perfGroup = 'water';` / `this.quad.userData.perfGroup = 'post';` |
| `riverReachScene.ts` | in `makeSceneRT`, `makeFinalRT`, `makeReflRT` | `rt.texture.name = 'opaque'`, `'water composite'`, `'reflection'` |
| `SideBySideOcean.tsx` | before `scene.add(field.surface.mesh)` / `scene.add(skyMesh)` | `field.surface.mesh.userData.perfGroup = 'water';` / `skyMesh.userData.perfGroup = 'sky'; scene.name = 'ocean';` |

## Tracker inventory

An audit on 2026-09-29 found 30 trackers beside the shared toolkit. "Merged"
means the private counter is gone and its page shows the shared number. "Kept"
means the tracker measures something the shared tool does not, or a rig reads
it.

| # | File | Page | Measures | Status after 2026-09-29 | Why that is safe |
|---|---|---|---|---|---|
| 1 | `src/components/World3D/World3DWrapper.tsx` (fps loop) | Game 3D world | fps from a second rAF loop, 1 s window, `setFps` once a second | **Merged.** Loop and state removed; the Debug HUD reads the `world3d` session. | Only the Debug HUD read it. `World3DScene` feeds `world3d` in every build. The old loop counted browser callbacks, not drawn frames, and re-rendered the wrapper every second in every build. |
| 2 | `src/components/World3D/WebGPUProbeScene.tsx` (`ProbeInstrument`) | `?phase=webgpuprobe` | fps, 500 ms window; `window.__webgpuProbeFps`; host badge | **Merged.** The badge reads `webgpu-probe`; the global is gone; status reports only on a backend change. | No rig in `tools/`, `scripts/` or `.agent/` reads the global. Proof: badge "WebGPU · 39 fps", session 37.9 fps. |
| 3 | `WebGPUProbeScene.tsx` (`AdaptiveFrameLoop`) | same | host rAF rate over 2 s | **Kept.** | It decides when to switch to a timer loop. It shows nothing. |
| 4 | `src/components/World3D/VolumeGroundBubble.tsx` `renderInfo()` | Game 3D world | calls, triangles, geometries on demand | **Kept.** | An on-demand read for `__volBubble`, not a live counter. |
| 5 | `VolumeGroundBubble.tsx` build stats | same | fill, mesh, wrap ms per build | **Kept.** | Build times, not frame times. |
| 6 | `src/components/World3D/water/riverReachScene.ts` `bench(n)` | `?step=water&river=1` | ms per frame with the GPU drained | **Kept.** | A GPU-drained bench; the live tool cannot give it. |
| 7 | `riverReachScene.ts` `frames` | same | frame count | **Kept.** | `__RIVER__.frames` is a capture contract. The river itself is now measured by the probe with no edit (session `auto:water`). |
| 8 | `riverReachScene.ts` cull counts | same | triangles per cull pass | **Kept.** | Cull diagnostics. |
| 9 | `src/components/DesignPreview/steps/FlipScene3D.tsx` | `?step=water&water=droplets` | fps EMA | **Merged.** The HUD reads `fluid-flip`; `__flipProof` keeps `frames`. | No rig reads `__flipProof.fps`. Proof: HUD 60, session 60. |
| 10 | `FluidScene3D.tsx` | `?step=water&water=grid` | "fps" that was really solver steps per second; chain ms | **Merged and renamed.** The field is `stepsPerSec`; the HUD shows the shared fps and steps/s; the chain time is a span; steps/s and starved bricks are readings. | No rig reads `__fluidProof.fps`. The old label called a step rate a frame rate. Proof: 60 fps, 70 steps/s. |
| 11 | `FluidSolverLegacy.tsx` | `?step=water&water=cpu` | fps EMA, step ms | **Merged.** The HUD reads `fluid-cpu`; the step is a span; wet cells is a reading. | No global. Proof: HUD 18, session 17.8. |
| 12 | `EntityDebugScene.tsx` stats feed | `?step=entitydebug`, `?step=herolab` | fps EMA; calls and triangles from `gl.info` | **Merged (fps).** `EntityDebugStats` has no `fps`; both HUDs read the window's session. Calls, triangles and segments stay. | `__entitydebug` never exposed the stats. Proof: HUD "60 fps · 84 calls · 784 tris", panel 60 fps, 84 calls, 784 tris. |
| 13 | `EarthGolemImg2ThreeScene.tsx` | entitydebug, img2threejs golem | fps over 500 ms; `renderer.info` | **Merged (fps).** Renderer named `golem-img2three`. | It had no probe; now it has a stable session. Proof: HUD 60, session 60. |
| 14 | `land/Reframe.tsx` `stats()` | `?step=land` | `gl.info` on demand | **Kept.** | On-demand read for `__volCam`. |
| 15 | `land/PointerRig.tsx` | `?step=land` | nothing (a comment only) | - | - |
| 16 | `src/components/BattleMap/camera/CameraController.tsx` `info()` | Combat map | one forced render's counters | **Kept.** | A rig snapshot of one forced render. |
| 17 | `CameraController.tsx` `sceneBreakdown()` | same | object counts by type | **Kept.** | Scene attribution, not frame time. |
| 18 | `BattleMap/terrain/VolumeArenaGround.tsx` worst carve frame | Combat map | worst carve-drain ms | **Kept.** | A carve budget probe for `__bmArena`. |
| 19 | `VolumeArenaGround.tsx` `sceneAudit()` | same | triangles by owner; `gl.info` | **Kept.** | Scene audit. |
| 20 | `BattleMap/dungeon/Dungeon3DPreview.tsx` `FrameProfiler` | `?step=dungeon`, in-game dungeon | frame ms percentiles between `start()` and `stop()` | **Kept.** | `tools/dungeon-profile/profile.mjs` reads `__dungeonProfile`; `BUDGET.md` results depend on it. |
| 21 | `Dungeon3DPreview.tsx` `benchRender` | same | bench ms per frame | **Kept.** | Same rig. |
| 22 | `sidebyside/SideBySideTrees.tsx` | `?step=land` trees panel | tree build ms | **Kept.** | Build time. The canvas is now measured by the probe. |
| 23 | `landTypeSwatch.ts` | `?step=land` land types | swatch render count | **Kept.** | A count of one-shot bakes; the probe skips one-shot renders. |
| 24-27 | `sidebyside/oceanExtras/wake.ts` benches | `?step=water&ocean=1` | wake compute ms, GPU frame ms, A/B | **Kept.** | Special GPU benches for the ocean gauntlet. |
| 28 | `src/systems/world3d/ocean/oceanSeabed.ts` `gpuPassMs` | same | GPU ms per render pass | **Kept.** | A seabed probe; see the r172 timestamp trap. |
| 29 | `sidebyside/SideBySideOcean.tsx` `__OCEAN__` and facts strip | `?step=water&ocean=1` | fps, ms per frame, CPU ms and split, GPU ms from timestamps | **Kept.** The probe measures the ocean with no edit. | `__OCEAN__` is the gauntlet's capture contract. The numbers agree: fps 60.0 and 60.0, frame 16.67 and 16.67 ms, CPU 1.04 and 1.02 ms. The strip's GPU rows show a constant (GG-332). |
| 30 | `misc/fiddle.html` | saved JSFiddle page | frames per second or more | **Kept.** | Not app code. It prints the frame count and does not divide by the time. |
| - | `PartLabScene.tsx`, `characterAtelier/CharacterScene.tsx` | `?step=partlab`, character atelier | nothing | Now measured by the probe. | - |

## Proof record (2026-09-29)

Headless Chrome on the real GPU (`--enable-unsafe-webgpu --use-angle=d3d11`),
1600x900, rig `.agent/scratch/perf-unify/shootPerf.mjs`. Captures and JSON are
throwaway files in `.agent/scratch/perf-unify/`.

| Page | Session | Reading |
|---|---|---|
| Ocean, `?step=water&ocean=1` | `auto:water`, WebGPU | 60 fps, 1.04 ms CPU, GPU "not measured on WebGPU", 3 draws, 526,273 triangles, 1 compute call |
| River, `?step=water&river=1` | `auto:water`, WebGL | 60 fps, GPU 7.94 ms, CPU 3.89 ms, 392 draws, 4.36 M triangles, 7 render passes |
| Entity Debug (R3F) | `entitydebug` | 60 fps, GPU 1.23 ms, 84 draws; HUD and badge agree |
| Game 3D world, `?phase=world3d` | `world3d` | 27.9 fps, 1,061 draws, 14.3 M triangles, 20 render passes, scene-cost breakdown |
| WebGPU probe, `?phase=webgpuprobe` | `webgpu-probe` | 37.9 fps; badge 39 fps from the same session |
| Fluid, droplets, CPU solver | `fluid-gpu`, `fluid-flip`, `fluid-cpu` | 60, 60, 17.8 fps; HUDs agree |
| Land, Building Lab, Character Atelier | `volume`, `building3d`, `auto:character-atelier-aralia` | 60 fps each |

### Diagnosis proof (2026-09-29, evening)

Rig `.agent/scratch/perf-diagnose/shootDiagnose.mjs`: the same Chrome with
`--enable-precise-memory-info --js-flags=--expose-gc`, one panel capture per
tab, a provoked slow frame (a resize, a 70 ms script and a GC), and a mark
before a change for compare. Captures: `river-<tab>.png`, `river-named-*.png`
(runtime tags as the patch would set them), `ocean-<tab>.png`.

| Item | River (`?step=water&river=1&full=1&live=1`, WebGL) | Ocean (`?step=water&ocean=1&full=1&sea=waterpro`, WebGPU) |
|---|---|---|
| 1 vsync floor | 60 Hz, 1 refresh a frame (92 to 100% of frames); work GPU 9.5 ms; wait 7.2 ms; headroom 7.2 ms (43%) | 60 Hz (100%); work CPU 1.2 ms; headroom 93%, "CPU side only" |
| 2 passes | 7 passes; GPU 0.35 · 3.57 · 0.42 · 4.20 · 0.30 · 0.88 · 0.03 ms, which sum to 9.75 ms against a frame mean of 9.48 ms (both are rolling means, over windows of slightly different length); named "river → ½ target" (the reflection) and "river → full target" (the opaque pass) with tags | "compute ×15" 0.19 ms CPU and "3 objects → screen" 0.60 ms CPU; GPU "—" with the reason |
| 3 groups | untagged: one "unnamed" row split by kind; tagged: vegetation 1.79 M, ground 1.13 M, stones 600 k, water 44 k | "OceanSky.mesh" 2 k; the water mesh unnamed (524 k) |
| 6 view | mounted 3.5 M, in view 1.85 M (equal to the opaque pass's drawn 1,849,583); screen share tagged: ground 44.7%, vegetation 37.2%, water 14.2%, stones 3.8%; nearest water 19.0 m | in view 526 k; screen share "not measured on WebGPU yet" |
| 4 causes | 121 texture uploads, 175 MB, 38 ms per 10 s (the live flow map); a readback of 7.4 to 9.3 ms (the exposure meter); a 97 ms frame named "browser: another animation-frame callback +90.2"; a GC note "heap fell 73 MB" | 1,780 buffer uploads, 259 KB per 10 s; the 171 ms frame named and its GC note |
| 7 memory | 593 geo, 13 tex, 14 prog, all +0 a second; heap precise | +0.4 textures a second over 10 s after a camera change |
| 8 compare | reflection off: GPU 9.38 → 6.08 ms (−3.30), draws 331 → 102, triangles 4.0 M → 1.9 M; the opaque pass alone rose 1.17 ms (the GPU clock drops with the load: the A/B note) | camera to "overhead": marked against live side by side |

## Related

- ADR: none. The probe is reversible: delete the staple imports and the
  toolkit falls back to `PerfProbe` measurement.
- Gaps: GG-332 to GG-339 (the first pass) and GG-352 to GG-359 (the
  diagnosis pass) in `docs/projects/GLOBAL_GAPS.md`.
- Plan map: `perf-toolkit-3d` in `public/planmap/topics.json`.
