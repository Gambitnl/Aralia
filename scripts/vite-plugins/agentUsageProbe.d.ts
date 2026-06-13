export declare const agentUsageProbe: () => {
    name: string;
    configureServer(server: {
        middlewares: {
            use: (p: string, h: (req: any, res: any) => void) => void;
        };
        config: {
            logger: {
                info: (s: string) => void;
            };
        };
    }): void;
};
