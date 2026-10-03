# Part Lab Capture API (`window.__partlab`)

Verified: 2026-09-09

Version: **1.0.0** (`PARTLAB_API_VERSION` in
`src/components/DesignPreview/steps/PartLabScene.tsx`, mirrored as
`PARTLAB_API_VERSION` in `tools/entities3d/capture/captureLib.mjs`)

## Purpose

`window.__partlab` is the debug/capture handle the Part Lab scene
(`design.html?step=partlab`) publishes so headless rigs and gate scripts can
read and drive it without owning a React ref. It has no other consumer inside
the app; it exists purely for the QA/capture tooling under `tools/`. Undeclared,
its shape only lived in the heads of whoever last touched a capture rig - this
doc is the contract those rigs are now allowed to assume, and the version stamp
lets a rig detect drift instead of failing silently on a missing field.

**Bump the version** whenever a field is added, removed, or changes shape.
Update this table and the `PARTLAB_API_VERSION` constant in both
`PartLabScene.tsx` and `captureLib.mjs` in the same change. `captureLib.mjs`'s
`gotoScene()` asserts `window.__partlab.apiVersion` against its own
`PARTLAB_API_VERSION` and throws a descriptive error on mismatch (convention 9
in that file's header).

## Where it is published (owners)

All four write sites live in
`src/components/DesignPreview/steps/PartLabScene.tsx`. React fires their
effects in the order the components appear in the tree - `Studio` (or
`MaskBackdrop`, mutually exclusive) mounts first, then `Turntable`, then
`LabCaptureHook` last - so on initial mount `LabCaptureHook`'s write is what
survives, because `Studio` and `LabCaptureHook` **replace** the object rather
than merge into it (`RigClipDriver` and `Turntable` merge with
`{ ...(w.__partlab ?? {}) }`). In practice this converges correctly because
`LabCaptureHook`'s effect deps (`scene, camera, gl, controls`) are a superset
of `Studio`'s (`scene, camera`), so any re-render that reruns `Studio` also
reruns `LabCaptureHook` after it. Known risk: a future write site added
between `Studio` and `LabCaptureHook` in the tree, or a dep-array edit that
breaks that superset relationship, would let a partial object win. Treat every
new write site as append-with-spread, not replace, to keep this converging.

| Component | Effect deps | Behavior |
|---|---|---|
| `RigClipDriver` (per-specimen rig/clip renderer) | `[built, offsetX]` | merges `clipDebug` in |
| `Studio` (plain studio backdrop; skipped when `maskStage`) | `[scene, camera]` | **replaces** with `{ apiVersion, camera, scene }` |
| `Turntable` | `[controls, on]` | merges `controls` in |
| `LabCaptureHook` | `[scene, camera, gl, controls]` | **replaces** with the full handle; unmount deletes `window.__partlab` |

## Fields

| Field | Type | Owner (write site) | Consumers |
|---|---|---|---|
| `apiVersion` | `string` (`PARTLAB_API_VERSION`) | every write site, added agora-8c1c (2026-09-09) | `captureLib.mjs` `gotoScene()` -> `assertPartLabApiVersion()` |
| `scene` | `THREE.Scene` | `LabCaptureHook`, `Studio` | `captureLib.mjs` (`grabCanvasPng`, `inkFraction`, `aimPartLab` - bone lookup via `scene.traverse`) |
| `camera` | `THREE.PerspectiveCamera` | `LabCaptureHook`, `Studio` | `captureLib.mjs` (`grabCanvasPng`, `inkFraction`, `aimPartLab`); `wave-gif.mjs` |
| `gl` | `THREE.WebGLRenderer` | `LabCaptureHook` (added 2026-09-09, agora-2560 - required for on-demand render of an animated capture; the canvas has no `preserveDrawingBuffer` by default) | `captureLib.mjs` (`grabCanvasPng`, `inkFraction` call `gl.render(scene, camera)`); presence gate for `aim-shot.mjs`, `partlab-shots.mjs`, `wave-gif.mjs`, `tools/creatureGate/motionGate.mjs`, `tools/entities3d/digitBandGate.mjs` (all wait on `window.__partlab && window.__partlab.gl` before capturing) |
| `controls` | `OrbitControls` (three-stdlib) | `LabCaptureHook`, `Turntable` (only mounted/live when the URL carries `&turn=1`) | `captureLib.mjs` `aimPartLab()` (sets `.target`, reads `.autoRotate`); `wave-gif.mjs` (`lab.camera`/`lab.controls` presence check) |
| `specimenGroup` | `string` (constant `'partlab:specimen'`) | `LabCaptureHook` | none yet - reserved so a future rig can `scene.getObjectByName(lab.specimenGroup)` instead of hardcoding the name a second time |
| `clipDebug` | `{ reference: SkinnedMesh, refRoot: SkinnedMesh, body: SkinnedBody }` | `RigClipDriver` (only mounted for the rigclip-driven specimen path, not the base-mesh path) | none yet - added for interactive debugging in the lab UI itself; no capture rig reads it today |

## Consumers (files that read `window.__partlab`)

- `tools/entities3d/capture/captureLib.mjs` - the shared rig library. `gotoScene()` defaults `hook` to `'window.__partlab'` and now asserts `apiVersion`; `grabCanvasPng()` and `inkFraction()` default `handle` to `'__partlab'` and read `gl`/`scene`/`camera`; `aimPartLab()` reads `controls`/`camera`/`scene`.
- `tools/entities3d/capture/aim-shot.mjs` - waits on `window.__partlab && window.__partlab.gl && window.__partlab.controls`.
- `tools/entities3d/capture/url-shot.mjs` - defaults its hook/handle to `__partlab`.
- `tools/entities3d/capture/partlab-shots.mjs` - waits on `window.__partlab && window.__partlab.gl`.
- `tools/entities3d/capture/wave-gif.mjs` - waits on the same hook; reads `lab.camera`/`lab.controls`.
- `tools/creatureGate/motionGate.mjs` - waits on `window.__partlab && window.__partlab.gl`; throws if `lab.gl` is missing.
- `tools/entities3d/digitBandGate.mjs` - waits on `window.__partlab`; calls `inkFraction`/`grabCanvasPng` with `handle: '__partlab'`.

No consumer in `Entity-Generator/tools/entities3d/capture/` references `__partlab` today (checked 2026-09-09) - that copy of the capture rigs targets Entity Studio's own scenes (`__wf3dScene`, `__entityforge`/`__entitydebug`), not the Aralia Part Lab. `src/components/DesignPreview/steps/PreviewPartLab.tsx` (the step's outer wrapper) does not touch `__partlab` either - only its lazy-loaded child `PartLabScene.tsx` does. No test file references `__partlab` by name as of this check.

## Related conventions

`tools/entities3d/capture/captureLib.mjs`'s file header documents the broader
headless-capture conventions (GPU args, `preserveDrawingBuffer`, render-then-read
in one task, navigation waits, liveness nonce, the `__r3f` fallback for
THREE-only surfaces, host/query-flag notes). This doc covers the `__partlab`
object's shape; that header covers how rigs use it safely.
