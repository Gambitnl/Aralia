import type { DevHubRouteContext } from './routeContext';
export declare const probeHttpUrl: (target: {
    port: number;
    label: string;
    expectedUrl: string;
}, checkedPath?: string, timeoutMs?: number) => Promise<any>;
export declare function handleDevServerRoutes(ctx: DevHubRouteContext): Promise<boolean>;
