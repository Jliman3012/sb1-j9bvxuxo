// Ambient declarations for the subset of the Deno runtime APIs that are used by
// the Supabase Edge Functions in this project. The goal is to provide strong
// typings for local type-checking without pulling in the full Deno lib target,
// which requires features from future TypeScript releases.

declare namespace Deno {
  interface ServeHandlerInfo {
    remoteAddr: {
      hostname: string;
      port: number;
      transport: 'tcp' | 'udp';
    };
  }

  interface ServeInit {
    hostname?: string;
    port?: number;
    signal?: AbortSignal;
    onListen?: (params: { hostname: string; port: number }) => void;
  }

  type ServeHandler = (
    request: Request,
    info: ServeHandlerInfo
  ) => Response | Promise<Response>;

  function serve(handler: ServeHandler, options?: ServeInit): void;

  const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  };
}
