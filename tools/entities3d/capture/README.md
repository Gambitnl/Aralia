# entities3d capture rigs

Headless capture rigs for the 3D entity surfaces. These caught every 3D
regression of the 2026-08/09 campaign while living in a gitignored scratch
folder; they are QA tools, so they live here.

| Rig | What it is for |
| --- | --- |
| `url-shot.mjs` | One URL, one canvas PNG, with the page's console errors and an ink-coverage number beside it. Reach for this first. |
| `aim-shot.mjs` | Bone-targeted close-up (`handR`, `head`, `footL`, ...). The default run is a right-hand close-up. |
| `partlab-shots.mjs` | The Part Lab contact sheet: one capture per part/body/material variant, in one session. |
| `wave-gif.mjs` | An animation as a GIF plus a frame sheet, for anything a still cannot show. |
| `captureLib.mjs` | The shared browser/render/read-back helper. **The conventions live in its file header — read that before writing a new rig.** |

Quick start (the dev server must already be running; nothing here starts one):

```bash
node tools/entities3d/capture/aim-shot.mjs .agent/scratch/my-proof/hand.png
node tools/entities3d/capture/url-shot.mjs "http://127.0.0.1:5174/Aralia/misc/design.html?step=partlab&turn=1" .agent/scratch/my-proof/lab.png
node tools/entities3d/capture/partlab-shots.mjs .agent/scratch/my-proof/partlab
node tools/entities3d/capture/wave-gif.mjs "http://127.0.0.1:5174/Aralia/misc/design.html?step=partlab&pose=walk&turn=1" .agent/scratch/my-proof/walk
```

Point them somewhere else with `CAPTURE_BASE` (a full page URL) or
`CAPTURE_ORIGIN` (`scheme://host:port`).

The eight conventions these rigs depend on — headless Chrome with the GPU
default-args removed, the `preserveDrawingBuffer` init-script shim, reading
pixels with `renderer.render()` + `canvas.toDataURL()` instead of
`page.screenshot()`, `waitUntil: 'commit'` with a 180 s nav timeout, the
liveness assert against HMR reloads, the `__r3f` route to an R3F store,
`127.0.0.1` + `&turn=1`, and keeping proof images under `.agent/scratch/` —
are each documented, with the failure that motivated them, in the header of
`captureLib.mjs`.

Keep this directory in sync with `tools/entities3d/capture/` in the
Entity-Generator repo. Only `DEFAULT_ORIGIN`/`DEFAULT_PAGE` in `captureLib.mjs`
are meant to differ between the two copies.
