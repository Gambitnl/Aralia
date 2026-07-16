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
      const ctx = { req, res, json, parsedUrl, urlPath };

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

      const { handleCreaturePlanRoutes } = await import('./devhub/creaturePlanRoutes.ts');
      if (await handleCreaturePlanRoutes(ctx)) return;

      // Character Review uses the canonical charset scanner but never exposes a
      // write route, so policy decisions remain separate from inspection.
      const { handleCharsetRoutes } = await import('./devhub/charsetRoutes.ts');
      if (await handleCharsetRoutes(ctx)) return;

      next();
    });
  }
});
