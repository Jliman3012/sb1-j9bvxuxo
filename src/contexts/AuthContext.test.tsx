import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { ReactNode } from 'react';

describe('AuthProvider', () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('renders a configuration fallback when Supabase env vars are missing', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { AuthProvider } = await import('./AuthContext');

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    render(
      <Wrapper>
        <div data-testid="app-content">App content</div>
      </Wrapper>,
    );

    expect(
      screen.getByRole('heading', { name: /supabase configuration is missing/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/please set the/i, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument();
    expect(screen.getByText('VITE_SUPABASE_ANON_KEY')).toBeInTheDocument();
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();
  });
});
