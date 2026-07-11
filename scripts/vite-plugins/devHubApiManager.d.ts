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
export declare const devHubApiManager: () => {
    name: string;
    configureServer(server: any): void;
};
