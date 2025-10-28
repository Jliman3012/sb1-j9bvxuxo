export interface SupabaseAuthResponse {
  data: { user: { id: string } | null };
  error: unknown | null;
}

export interface SupabaseFunctionResponse<TResponse = unknown> {
  data: TResponse | null;
  error: unknown | null;
}

export interface SupabaseClient {
  from(table: string): any;
  auth: {
    getUser(accessToken?: string): Promise<SupabaseAuthResponse>;
  };
  functions: {
    invoke<TResponse = unknown>(
      name: string,
      options?: {
        body?: unknown;
        headers?: Record<string, string>;
      },
    ): Promise<SupabaseFunctionResponse<TResponse>>;
  };
}

export declare function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: unknown,
): SupabaseClient;
