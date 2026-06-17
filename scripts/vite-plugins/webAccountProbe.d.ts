/**
 * Web account probes are dashboard snapshots for browser-authenticated SaaS
 * accounts. They deliberately store durable login state in per-account browser
 * profiles outside the repo, while returning only small, sanitized usage data
 * to Agent Matrix.
 */
export interface WebAccountProbeUsage {
    label: string;
    used?: number;
    limit?: number;
    pct?: number;
    resetsAt?: string;
}
export interface WebAccountProbeResult {
    provider: 'cursor';
    accountId: string;
    profileDir: string;
    fetchedAt: number;
    loginRequired: boolean;
    lines: string[];
    summary?: string;
    usage?: WebAccountProbeUsage;
}
interface ProbeCursorAccountOptions {
    homeDir?: string;
    fetchedAt?: number;
    runner?: (profileDir: string) => Promise<string>;
}
interface OpenCursorLoginOptions {
    homeDir?: string;
    opener?: (profileDir: string, options: {
        accountId: string;
        homeDir: string;
    }) => Promise<void>;
}
interface ClearProfileOptions {
    homeDir?: string;
}
export declare const getWebAccountProfileDir: (accountId: string, homeDir?: string) => string;
export declare const isWebAccountProbeAgent: (accountId: string) => boolean;
export declare const parseCursorDashboardText: (accountId: string, text: string, profileDir: string, fetchedAt?: number) => WebAccountProbeResult;
export declare const probeCursorAccount: (accountId: string, options?: ProbeCursorAccountOptions) => Promise<WebAccountProbeResult>;
export declare const openCursorAccountLogin: (accountId: string, options?: OpenCursorLoginOptions) => Promise<{
    ok: boolean;
    accountId: string;
    profileDir: string;
    message: string;
}>;
export declare const clearWebAccountProfile: (accountId: string, options?: ClearProfileOptions) => Promise<{
    ok: boolean;
    accountId: string;
    profileDir: string;
}>;
export {};
