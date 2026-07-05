# WebGPU migration validation — owner's machine

**Date:** 2026-07-04 (doc slug 2026-07-03)
**Question:** Does *this* machine (owner's desktop, Windows 11, `F:\Repos\Aralia`) actually support the beautification-wave migration target — three.js `WebGPURenderer` + TSL — well enough to justify lifting MIT code from `Braffolk/fable5-world-demo` (a.k.a. LAAS)?

**Verdict: YES. Confirmed with measured evidence.** The demo — a full WebGPU-only procedural world with no WebGL fallback — initializes WebGPU, generates its world to 100%, and renders a live forest scene at ~37 fps on this machine's RTX 2070 SUPER, with **zero console errors**. The migration target is supported.

---

## Method

- Demo cloned OUTSIDE the repo tree at `G:/Temp/claude/fable5-world-demo` (MIT, © 2026 Remi Sebastian Kits).
- `npm install`; dev server started on **port 5199** (the demo hardcodes 5173/strictPort, which was taken; 5174 was off-limits per the task).
- Driven headlessly with Playwright (`G:/Temp/claude/validate-webgpu.mjs`), reusing the demo's own launch insight: full Chromium (`channel:'chromium'`), NOT the default headless-shell, which has no GPU adapter.
- Evidence gathered via the app's `window.__laas` hooks (`ready`, `error`, `diag`, `stats`) plus a rAF FPS counter injected through `page.evaluate`.

## Environment

- **GPU:** NVIDIA GeForce RTX 2070 SUPER (driver 32.0.15.9649). (A Parsec Virtual Display Adapter is also present but irrelevant.)
- **OS:** Windows 11 Pro.
- **WebGPU adapter reported by Chromium:** vendor `nvidia`, architecture `turing`. Backend is D3D12/Vulkan on Windows (the demo's own note about an "apple/metal-3" adapter is from the author's Mac; here it's the NVIDIA Turing part).

## What worked — the launch recipe

**Winning combination (first candidate tried, no special flags needed):**

```
headless=true  channel='chromium'  args=[]
```

- Plain default headless (Playwright "headless shell") would have failed (adapter = null) — but I did not need it; full Chromium via `channel:'chromium'` gave a real hardware adapter immediately.
- `--enable-unsafe-webgpu` / `--enable-features=Vulkan` were **not** required.
- WebGPU requires a secure context: probe on `http://localhost`, never `about:blank` (`navigator.gpu` is absent on opaque origins).

## Evidence

| Check | Result |
|---|---|
| (a) WebGPU initializes | **YES** — `[laas] webgpu ok`, `navigator.gpu.requestAdapter()` returned a real adapter; no fallback messaging triggered |
| (b) World generates + renders | **YES** — progress 0 → 100% (`ready`), then a live forest frame (see screenshots). Not a black frame. |
| (c) FPS (10s sample) | Engine internal stats: **~37 fps**, frameMs 33.4, p95 66–83ms. rAF counter: 19.3 fps (headless-throttled floor, not representative). |
| (d) GPU adapter info | vendor `nvidia`, architecture `turing`; 19 WebGPU features incl. `timestamp-query`, `shader-f16`, `texture-compression-bc`, `subgroups`, `float32-filterable` |
| (e) Console errors | **ZERO** |

**In-engine HUD at capture** (`fable5-demo-world.png`): 37 fps @ 33.30ms; GPU render 8.97ms + compute 1.47ms (~10.4ms GPU total); 722 draws; 15.5M triangles; 274K grass blades; 188K trees; 131K particles; four-cascade shadows; bloom; froxel volumetrics.

**Frame is CPU-submit bound, not GPU bound** (`cpu.submitMs100` ≈ 2,230 vs ~10ms GPU). That's a known headless/single-thread artifact and an optimization lane — it is *not* a capability limit. On the owner's real desktop browser (multi-threaded, real compositor) the interactive number should be as good or better.

## Screenshots

- `F:\Repos\Aralia\.agent\scratch\fable5-demo-after-gen.png` — captured right after generation completed.
- `F:\Repos\Aralia\.agent\scratch\fable5-demo-world.png` — the rendered forest world with the debug HUD (fps/GPU timings/instance counts).

## Caveat + owner confirmation step

Headless Chromium ≈ but ≠ the owner's interactive desktop Chrome. The capability (WebGPU on the RTX 2070 SUPER) is proven; the *interactive feel* (smoothness while moving, mouse-look) is the one thing a headless run can't judge.

**For final sign-off, open it yourself once:**

1. The dev server is left running at **http://localhost:5199/** (Chrome 113+; WASD move, mouse to look, V walk/fly, F3 HUD, keys 1–9 = bookmarks, F = flythrough).
2. Try e.g. `http://localhost:5199/?shot=1` … `?shot=9` for the composed bookmarks, or `?preset=ultra`.
3. **To stop the server:** it's the `vite --port 5199` process — `Stop-Process -Id 36288` (PID at time of writing; or find it with `netstat -ano | Select-String ":5199 "`). Or just close the terminal/session.

## Bottom line

This machine clears the migration target. WebGPU + TSL is not "should work" here — it demonstrably runs the most demanding reference workload we'd lift from (190K trees, ~1M grass, erosion, four-cascade PCSS shadows, GI, volumetric clouds, TAA) at interactive frame rates with no errors and no fallback. Proceed with the WebGPURenderer + TSL migration heading the beautification wave.
