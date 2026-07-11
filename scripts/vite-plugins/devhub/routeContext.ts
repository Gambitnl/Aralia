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
};
