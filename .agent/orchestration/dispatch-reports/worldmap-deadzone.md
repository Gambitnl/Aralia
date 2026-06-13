Here's the complete READ-ONLY analysis.

---

## Root Cause

The dead zone is an **SVG aspect-ratio letterbox** inside the Azgaar iframe.

### Layout chain (all verified)

| Layer | File | How it sizes |
|---|---|---|
| WindowFrame | `src/components/ui/WindowFrame.tsx:44-51` | Fixed-position window, explicit px width/height from `useResizableWindow` (maximized: `innerWidth-40` × `innerHeight-40`) |
| Content area | `WindowFrame.tsx:128` | `flex-1 overflow-hidden relative` — fills remaining height, full width |
| MapPane root | `MapPane.tsx:463` | `h-full w-full flex flex-col` with `p-4 md:p-6` padding |
| Azgaar container | `MapPane.tsx:562` | `relative overflow-hidden flex-grow` — fills remaining vertical space, full width |
| iframe | `MapPane.tsx:567` | `absolute inset-0 h-full w-full` — fills container |
| **#map SVG** | `public/vendor/azgaar/index.html:152-162` | `width="100%" height="100%"`, **no `viewBox`, no `preserveAspectRatio`** in static HTML |

### The mismatch

- Azgaar's JS sets `viewBox="0 0 {graphWidth} {graphHeight}"` at init time. Defaults are **960 × 540** (16:9 ≈ 1.778:1) from `src/systems/worldforge/adapter/worldGenOptions.ts:153-154`.
- The iframe viewport is much **wider** than 16:9 when the WindowFrame is maximized (e.g. ~1832 × 928 ≈ 1.974:1 after toolbar and padding).
- The SVG has **no `preserveAspectRatio` attribute** — the SVG spec default is `xMidYMid meet`, which scales content to fit the *smaller* dimension and **letterboxes the other**.
- `grep` of the minified Azgaar JS (`index-DYkjnO4Z.js`) for `preserveAspectRatio` returns **zero matches** — Azgaar never overrides this.

### Result

The map content scales to fill height, occupying only ~`540 × (viewport_w / viewport_h)` of the 960-unit viewBox width. The remaining SVG area is empty, exposing the iframe body background (dark after Azgaar initialization). The scale bar (`<g id="scaleBar">` inside the SVG at `index.html:374`) and the Reset Zoom button (`#sticked > #zoomReset` at `index.html:2475`, the only non-hidden sticked button per the CSS rule `#sticked > button:not(#zoomReset) { display: none !important; }` at `MapPane.tsx:150`) render in their normal SVG/HTML positions — but the map content behind them doesn't fill the viewport, so they appear to float in the void.

### Why Aralia's existing CSS override doesn't help

`MapPane.tsx:152-158` injects CSS that forces the SVG **element** to `inset:0; width:100%; height:100%` — this works. But the letterboxing happens **inside** the SVG, between the viewBox coordinate system and the viewport, controlled by `preserveAspectRatio`. CSS cannot fix that.

---

## BEGIN_PROPOSAL

```diff
--- a/src/components/MapPane.tsx
+++ b/src/components/MapPane.tsx
@@ -217,6 +217,12 @@
             blockedIds.forEach(function (id) {
               var el = document.getElementById(id);
               if (!el) return;
               try { el.setAttribute('aria-disabled', 'true'); } catch (e) {}
               try { el.style.pointerEvents = 'none'; el.style.opacity = '0.45'; } catch (e) {}
               try { el.title = 'Disabled in Aralia embed'; } catch (e) {}
             });
+
+            // Force the SVG to stretch-fill the iframe viewport instead of
+            // letterboxing via the default preserveAspectRatio="xMidYMid meet".
+            var mapSvg = document.getElementById('map');
+            if (mapSvg) {
+              mapSvg.setAttribute('preserveAspectRatio', 'none');
+            }
           } catch (e) {
             // ignore
           }
```

**What this does:** After the Azgaar bridge script initializes, it sets `preserveAspectRatio="none"` on the `#map` SVG. This makes the SVG content stretch to fill the entire iframe viewport — no letterbox dead zone. Aralia's cell-mapping math (`resolveCellFromPointer` at `MapPane.tsx:290-320`) works in normalized [0,1] coordinates over the overlay bounds, so stretching the SVG doesn't break travel or hover targeting.

**Trade-off:** On viewports wider than 16:9, the map is horizontally stretched (continents appear wider). This is the minimal fix. If distortion is unacceptable, `'xMidYMid slice'` would crop top/bottom instead of stretching, but that hides polar map regions.

## END_PROPOSAL
