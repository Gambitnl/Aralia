# Wildkin header design QA

- Source visual truth: `F:/Repos/Aralia/.agent/scratch/wildkin-header-qa/agora-source-full.png`
- Implementation screenshot: `F:/Repos/Aralia/.agent/scratch/wildkin-header-qa/wildkin-implementation-full.png`
- Viewport and images: both 1695 × 1270 CSS/picture pixels; device pixel ratio 1; no density normalization needed.
- State: dark theme, live SSE, Agora Board versus Wildkin repo view. The comparison target is the shared header; the different board content and scoped counts are intentional.

## Comparison

The full-view captures were inspected together. The top 120 px remained legible at the captured resolution, so a separate focused crop was unnecessary. Both pages now show the same brand, version/uptime/port, Cockpit, live-connection badge, refresh/poll timing, Docs, Board/Wildkin/Pets navigation, and seven count tiles. Wildkin's extra `Open Wildkin` and manual `Refresh` actions are intentional repo-specific controls. A visible `Wildkin scope` label identifies its six activity counts; the linked open-gaps tile is explicitly Agora-wide in its tooltip.

## Required fidelity checks

- Typography: shared header now uses Agora's system and monospace families, sizes, and hierarchy. Repo panel typography remains intentionally distinct.
- Spacing and layout: header height, two-row wrap, tile sizing, and panel start align at 1695 px. The two repo-only controls shift later nav items slightly but do not obscure any item.
- Colors: header background, borders, text, status dot, and count tiles use Agora's dark tokens. Wildkin's panel blue is retained as a repo-view treatment.
- Assets: no new image assets; the existing Agora header glyphs and labels are reused. No image-quality regression was visible.
- Copy: shared controls match Agora. `Wildkin scope` distinguishes the six repo activity counts, while `open gaps` links to the global registry and is labeled as Agora-wide; no Wildkin activity is presented as global activity.

## Interactions and evidence

- Browser navigation from Wildkin opened the real Pets tab and Docs panel.
- Manual Refresh completed; live SSE status and poll countdown appeared; browser error log was empty.
- The narrow 620 px check had no horizontal overflow. A smaller-phone check was not established because the browser's viewport override affected another tab, so no phone-width claim is made.
- `node --check tools/agora/dashboard/wildkin.mjs` and `node --test tools/agora/dashboard/wildkin-scope.test.mjs` passed.

## Comparison history

1. Initial P1: Wildkin lacked Agora's version, Cockpit, Docs, Pets, SSE/poll status, and open-gaps link. Added real data and navigation; desktop browser proof confirmed them.
2. Initial P2: header font and refresh-text width differed. Applied Agora's header font/tokens; the subsequent equal-size capture showed the intended rhythm.
3. Initial P2: Wildkin ignored the user's existing panel-collapse preference. It now reads Agora's preference on first load and stores later Wildkin toggles separately, without changing the main board preference.

No actionable P0/P1/P2 mismatch remains for the requested header comparison. The repo-only actions and scoped counts are expected differences.

final result: passed
