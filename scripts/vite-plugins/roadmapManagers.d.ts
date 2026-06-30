export declare const ROADMAP_DEV_PORT = 3010;
export declare const ROADMAP_DEV_HOST = "127.0.0.1";
export declare const ROADMAP_DEV_OPEN_PATH = "/Aralia/devtools/roadmap/roadmap.html";
export declare const ROADMAP_DEV_HEALTH_URL = "http://127.0.0.1:3010/api/roadmap/data";
export declare const ROADMAP_DEV_OPEN_URL = "http://127.0.0.1:3010/Aralia/devtools/roadmap/roadmap.html";
export type RoadmapDevServerStatus = {
    running: boolean;
    openUrl: string;
    healthUrl: string;
};
export declare const getRoadmapDevServerStatus: () => Promise<RoadmapDevServerStatus>;
export declare const roadmapLauncherManager: () => {
    name: string;
    configureServer(server: any): void;
};
export declare const roadmapManager: () => {
    name: string;
    configureServer(server: any): void;
};
