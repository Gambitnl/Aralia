export declare const DEVHUB_DEV_PORT = 3030;
export declare const DEVHUB_DEV_HOST = "127.0.0.1";
export declare const DEVHUB_DEV_OPEN_PATH = "/Aralia/misc/dev_hub.html";
export declare const DEVHUB_DEV_HEALTH_URL = "http://127.0.0.1:3030/api/health/env";
export declare const DEVHUB_DEV_OPEN_URL = "http://127.0.0.1:3030/Aralia/misc/dev_hub.html";
export declare const OPERATOR_DASHBOARD_PORT = 3040;
export declare const OPERATOR_DASHBOARD_HOST = "127.0.0.1";
export declare const OPERATOR_DASHBOARD_ROOT = "F:\\Repos\\Aralia-operator-dashboard";
export declare const OPERATOR_DASHBOARD_ORIGIN = "http://127.0.0.1:3040";
export declare const OPERATOR_DASHBOARD_HEALTH_URL = "http://127.0.0.1:3040/api/health/operator";
export type DevHubDevServerStatus = {
    running: boolean;
    openUrl: string;
    healthUrl: string;
};
export declare const getDevHubDevServerStatus: () => Promise<DevHubDevServerStatus>;
export type OperatorDashboardStatus = {
    running: boolean;
    origin: string;
    healthUrl: string;
};
export declare const getOperatorDashboardStatus: () => Promise<OperatorDashboardStatus>;
export declare const devHubLauncherManager: () => {
    name: string;
    configureServer(server: any): void;
};
