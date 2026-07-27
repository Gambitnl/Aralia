interface DevHubRouteContext {
    req: any;
    res: any;
    json: (data: unknown, status?: number) => void;
    parsedUrl: URL;
    urlPath: string;
}
export declare function handleLoreSearchRoutes(ctx: DevHubRouteContext): Promise<boolean>;
export {};
