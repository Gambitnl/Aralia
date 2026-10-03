declare module 'ws' {
  export class WebSocket {
    constructor(url: string | URL, options?: any);
    on(event: string, listener: (...args: any[]) => void): this;
    send(data: any, options?: any, callback?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    readyState: number;
    static OPEN: number;
    static CLOSED: number;
  }
  export class WebSocketServer {
    constructor(options?: any);
    on(event: string, listener: (...args: any[]) => void): this;
    clients: Set<WebSocket>;
    close(callback?: (err?: Error) => void): void;
    address(): any;
  }
}

declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string | Buffer, options?: any);
    window: any;
  }
}

