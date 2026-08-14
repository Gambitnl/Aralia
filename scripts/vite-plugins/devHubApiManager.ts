/**
 * This file adds local-only API routes to the Vite development server.
 *
 * The Dev Hub browser pages call these routes to read project documentation,
 * spell inventories, GitHub status, and editable markdown files without adding
 * a separate database. The project dashboard routes below read docs/projects
 * directly and return small status signals that shared browser components turn
 * into visual cards.
 *
 * The individual route handlers live in per-domain modules under ./devhub/.
 * This entry stays a thin manager: it builds the shared per-request context
 * (the json helper + parsed URL) and dispatches to each domain handler in turn.
 *
 * IMPORTANT: vite.config.ts statically imports this file, so anything it
 * statically imports joins Vite's config dependency graph and a change to it
 * triggers a full dev-server restart. The domain modules pull in heavy work
 * (spell inventory, doc usage scans), so they are loaded with DYNAMIC import()
 * inside the request handler — this keeps the entry import-light and stops the
 * running dev server from restarting when those modules change. See the
 * vite-dynamic-import-config-deps pattern.
 */
import path from 'path';
import { pathToFileURL } from 'url';

// ============================================================================
// Creature Planner Isolation
// ============================================================================
// Most route modules can use ordinary lazy imports. The creature planner is different:
// it eventually reaches the actively developed 3D entity system, so even a literal lazy
// import makes Vite watch those game files as configuration dependencies. An absolute URL
// held in a variable keeps that route available without exposing its source graph to Vite.
// ============================================================================

function creaturePlanRoutesModuleUrl(): string {
  return pathToFileURL(
    path.resolve(process.cwd(), 'scripts/vite-plugins/devhub/creaturePlanRoutes.ts'),
  ).href;
}

function heroLabRoutesModuleUrl(): string {
  return pathToFileURL(
    path.resolve(process.cwd(), 'scripts/vite-plugins/devhub/heroLabRoutes.ts'),
  ).href;
}

// ============================================================================
// Vite Middleware
// ============================================================================
// This manager builds one shared request context and gives each devhub domain a chance to
// answer. A domain that handles the request ends the chain; otherwise the request continues.
// ============================================================================

export const devHubApiManager = () => ({
  name: 'devhub-api-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      const urlPath = parsedUrl.pathname;
      const ctx = { req, res, json, parsedUrl, urlPath, server };

      const { handleProjectRoutes } = await import('./devhub/projectRoutes.ts');
      if (await handleProjectRoutes(ctx)) return;

      const { handleDevServerRoutes } = await import('./devhub/devServerRoutes.ts');
      if (await handleDevServerRoutes(ctx)) return;

      const { handleSpellRoutes } = await import('./devhub/spellRoutes.ts');
      if (await handleSpellRoutes(ctx)) return;

      const { handleCiTestRoutes } = await import('./devhub/ciTestRoutes.ts');
      if (await handleCiTestRoutes(ctx)) return;

      const { handleHealthRoutes } = await import('./devhub/healthRoutes.ts');
      if (await handleHealthRoutes(ctx)) return;

      const { handleOllamaRoutes } = await import('./devhub/ollamaRoutes.ts');
      if (await handleOllamaRoutes(ctx)) return;

      const { handleUrlInventoryRoutes } = await import('./devhub/urlInventoryRoutes.ts');
      if (await handleUrlInventoryRoutes(ctx)) return;

      const { handleAgentConfigRoutes } = await import('./devhub/agentConfigRoutes.ts');
      if (await handleAgentConfigRoutes(ctx)) return;

      const { handleDocsRoutes } = await import('./devhub/docsRoutes.ts');
      if (await handleDocsRoutes(ctx)) return;

      // Only load the isolated creature planner for one of its three public URLs. The URL is
      // deliberately opaque to Vite, because a literal import here would reconnect every 3D
      // entity source file to vite.config.ts and restart the server during entity work.
      if (
        urlPath === '/devhub/api/creature-plan'
        || urlPath === '/devhub/api/creature-plan/approve'
        || urlPath === '/devhub/api/creature-plans'
      ) {
        const moduleUrl = creaturePlanRoutesModuleUrl();
        const { handleCreaturePlanRoutes } = await import(/* @vite-ignore */ moduleUrl) as {
          handleCreaturePlanRoutes: (routeContext: typeof ctx) => Promise<boolean>;
        };
        if (await handleCreaturePlanRoutes(ctx)) return;
      }

      // Hero Lab owns long-running child processes and scratch GLB artifacts.
      // Keep that Node-only graph behind its URL prefix so ordinary preview
      // navigation does not load the remote-generation machinery.
      if (urlPath.startsWith('/devhub/api/hero-lab/')) {
        const moduleUrl = heroLabRoutesModuleUrl();
        const { handleHeroLabRoutes } = await import(/* @vite-ignore */ moduleUrl) as {
          handleHeroLabRoutes: (routeContext: typeof ctx) => Promise<boolean>;
        };
        if (await handleHeroLabRoutes(ctx)) return;
      }

      const { handleLoreSearchRoutes } = await import('./devhub/loreSearchRoutes.ts');
      if (await handleLoreSearchRoutes(ctx)) return;

      // Character Review uses the canonical charset scanner but never exposes a
      // write route, so policy decisions remain separate from inspection.
      const { handleCharsetRoutes } = await import('./devhub/charsetRoutes.ts');
      if (await handleCharsetRoutes(ctx)) return;

      next();
    });
  }
});
