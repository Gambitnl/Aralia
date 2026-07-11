export type DevHubRouteContext = {
    req: any;
    res: any;
    json: (data: any, status?: number) => void;
    parsedUrl: URL;
    urlPath: string;
};
