/**
 * This file adds local-only API routes to the Vite development server.
 *
 * The Dev Hub browser pages call these routes to read project documentation,
 * spell inventories, GitHub status, and editable markdown files without adding
 * a separate database. The project dashboard routes below read docs/projects
 * directly and return small status signals that shared browser components turn
 * into visual cards.
 */
export declare const devHubApiManager: () => {
    name: string;
    configureServer(server: any): void;
};
