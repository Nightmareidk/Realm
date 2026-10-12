// The parts of `ws` the gateway uses. (`ws` ships no types and @types/ws isn't installed.)
declare module "ws" {
  import { EventEmitter } from "node:events";
  import type { IncomingMessage } from "node:http";
  import type { Duplex } from "node:stream";

  export class WebSocket extends EventEmitter {
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;
    readonly readyState: 0 | 1 | 2 | 3;
    send(data: string, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    on(event: "message", listener: (data: Buffer, isBinary: boolean) => void): this;
    on(event: "close", listener: (code: number, reason: Buffer) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
  }

  export interface ServerOptions {
    noServer?: boolean;
    maxPayload?: number;
    perMessageDeflate?: boolean;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options: ServerOptions);
    readonly clients: Set<WebSocket>;
    handleUpgrade(
      req: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (ws: WebSocket, req: IncomingMessage) => void,
    ): void;
    close(callback?: (err?: Error) => void): void;
  }
}
