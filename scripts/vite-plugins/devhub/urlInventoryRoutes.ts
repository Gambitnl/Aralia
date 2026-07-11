import path from 'path';
import fs from 'fs';
import type { DevHubRouteContext } from './routeContext';

export async function handleUrlInventoryRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { json, urlPath } = ctx;

  // Live URL inventory — a real filesystem scan for the URL Directory page.
  // The page renders an instant build-time list (import.meta.glob + routes.ts),
  // then calls this so a "Rescan" button can pick up HTML pages or phases
  // added/removed on disk WITHOUT a rebuild. Parsing source here (rather than
  // importing the TS) keeps this server-side and dependency-free.
  if (urlPath === '/api/dev/url-inventory') {
    try {
      const root = process.cwd();
      const base = '/Aralia/';

      // 1. In-app phase routes: GamePhase enum members + clean-slug overrides.
      const coreSrc = fs.readFileSync(path.resolve(root, 'src/types/core.ts'), 'utf-8');
      const enumBody = coreSrc.match(/export enum GamePhase\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
      const phaseNames = enumBody
        .split(/\r?\n/)
        .map((line) => line.replace(/\/\/.*$/, '').trim()) // strip line comments
        .map((line) => line.match(/^([A-Z][A-Z0-9_]*)\s*(?:=|,|$)/)?.[1])
        .filter((name): name is string => Boolean(name));

      const routesSrc = fs.readFileSync(path.resolve(root, 'src/routes.ts'), 'utf-8');
      const overrides: Record<string, string> = {};
      for (const m of routesSrc.matchAll(/\[GamePhase\.([A-Z0-9_]+)\]:\s*'([^']+)'/g)) {
        overrides[m[1]] = m[2];
      }
      const phaseRoutes = phaseNames.map((name) => {
        const slug = overrides[name] ?? name.toLowerCase();
        return { label: name, slug, url: `${base}?phase=${slug}`, clean: name in overrides };
      });

      // 2. Standalone HTML pages — real directory listings.
      const globHtml = (dir: string, tag: string) => {
        const abs = path.resolve(root, dir);
        if (!fs.existsSync(abs)) return [];
        return fs
          .readdirSync(abs)
          .filter((f: string) => f.endsWith('.html'))
          .sort()
          .map((f: string) => ({
            tag,
            label: f.replace(/\.html$/, '').replace(/[_-]/g, ' '),
            file: `${dir}/${f}`,
            url: `${base}${dir}/${f}`,
          }));
      };
      // Load standalone HTML pages located in the misc/ directory.
      const miscPages = [
        ...globHtml('misc', 'misc'),
        // Manually register the Ollama diagnostics dashboard page since it resides
        // in its own dedicated subfolder under tools/ rather than misc/ root.
        ...(fs.existsSync(path.resolve(root, 'tools/ollama/index.html'))
          ? [{ tag: 'tool', label: 'Ollama dashboard', file: 'tools/ollama/index.html', url: `${base}tools/ollama/index.html` }]
          : [])
      ];
      // Load standalone roadmap HTML pages.
      const roadmapPages = globHtml('devtools/roadmap', 'roadmap');

      // 3. Deep-link flags handled outside the phase system.
      const flags = [
        {
          label: 'World Map / World Generation',
          url: `${base}?worldmap=1`,
          note: '?worldmap=1  (alias: ?view=worldgen)',
        },
      ];

      json({
        scannedAt: new Date().toISOString(),
        counts: {
          phases: phaseRoutes.length,
          pages: miscPages.length + roadmapPages.length,
          flags: flags.length,
        },
        rootApp: [{ label: 'Main Game', url: base }],
        phaseRoutes,
        flags,
        miscPages,
        roadmapPages,
      });
    } catch (e) {
      json({ error: String(e) }, 500);
    }
    return true;
  }

  return false;
}
