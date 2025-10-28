// Type stubs to make Supabase Edge Function source files compile under tooling
// that doesn't include the Deno runtime definitions. Supabase injects these
// globals at runtime, so we only describe the pieces referenced in our code.

declare global {
  interface DenoEnv {
    get(key: string): string | undefined;
  }

  interface DenoServeHandlerInfo {
    remoteAddr: {
      hostname: string;
      port: number;
    };
  }

  interface DenoServeOptions {
    port?: number;
    hostname?: string;
  }

  interface DenoNamespace {
    env: DenoEnv;
    serve: (
      handler: (
        request: Request,
        info: DenoServeHandlerInfo,
      ) => Response | Promise<Response>,
      options?: DenoServeOptions,
    ) => unknown;
  }

  const Deno: DenoNamespace;
}

export {};
