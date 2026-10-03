// Shared request context passed to every per-domain Dev Hub route handler.
// devHubApiManager.ts builds this once per request (the json helper, the parsed
// URL, and the raw req/res) and hands it to each domain module in turn. Each
// handler returns true when it has answered the request so the manager can stop
// dispatching, or false to let the next domain module (and finally next()) run.
export type DevHubRouteContext = {
  req: any;
  res: any;
  json: (data: any, status?: number) => void;
  parsedUrl: URL;
  urlPath: string;
  /**
   * The Vite dev server, for handlers that must load PROJECT SOURCE at runtime.
   *
   * Use `ctx.server.ssrLoadModule('/src/...')` rather than a raw `import()` of a
   * file:// URL. Node's ESM resolver cannot resolve the extensionless relative
   * specifiers our source uses (`import … from '../registry'`), so a raw import
   * dies on the first transitive hop. Node 22.19 strips TypeScript types, which
   * makes the `.ts` file itself load and pushes the failure one level deeper —
   * it does not make the specifiers resolvable. `ssrLoadModule` resolves exactly
   * like the app does, and being a runtime call it does NOT add the loaded file
   * to vite.config.ts's dependency graph, so entity edits still do not restart
   * the server.
   */
  server: any;
};
