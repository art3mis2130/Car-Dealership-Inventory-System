import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthProvider.js';
import { useAuth } from '../src/hooks/useAuth.js';
import { ProtectedRoute } from '../src/components/ProtectedRoute.js';

const TOKEN_KEY = 'apex-motors.token';

const adminUser = {
  id: 'u1',
  name: 'Avery Admin',
  email: 'avery@example.com',
  role: 'ADMIN' as const,
  createdAt: '2026-01-01 00:00:00',
};

/** Queues one fetch response per call, in order. */
function mockFetchSequence(responses: { status: number; body: unknown }[]) {
  const fetchMock = vi.fn();

  for (const { status, body } of responses) {
    fetchMock.mockResolvedValueOnce({
      status,
      ok: status >= 200 && status < 300,
      json: () => Promise.resolve(body),
    });
  }

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function Probe() {
  const { user, isAdmin, initialising, logout } = useAuth();

  return (
    <div>
      <p data-testid="state">
        {initialising ? 'loading' : user ? `signed in as ${user.name}` : 'signed out'}
      </p>
      <p data-testid="role">{isAdmin ? 'admin' : 'not admin'}</p>
      <button type="button" onClick={logout}>
        Sign out
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('AuthProvider', () => {
  it('starts signed out when there is no stored token, without calling the API', async () => {
    const fetchMock = mockFetchSequence([]);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signed out'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores a session by asking the server whether the stored token is still good', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    const fetchMock = mockFetchSequence([
      { status: 200, body: { success: true, data: { user: adminUser } } },
    ]);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('signed in as Avery Admin'),
    );
    expect(screen.getByTestId('role')).toHaveTextContent('admin');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer stored-token');
  });

  it('discards a token the server no longer accepts', async () => {
    // Trusting localStorage alone would leave the UI pretending to be signed
    // in while every request failed.
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    mockFetchSequence([
      { status: 401, body: { success: false, error: { code: 'UNAUTHORIZED', message: 'nope' } } },
    ]);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signed out'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('keeps the session when /me fails for a reason other than auth', async () => {
    // A 500 or a dropped connection is not evidence that the token is bad.
    localStorage.setItem(TOKEN_KEY, 'good-token');
    mockFetchSequence([
      { status: 500, body: { success: false, error: { code: 'INTERNAL_ERROR', message: 'oops' } } },
    ]);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).not.toHaveTextContent('loading'));
    expect(localStorage.getItem(TOKEN_KEY)).toBe('good-token');
  });

  it('clears the stored token on sign out', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    mockFetchSequence([{ status: 200, body: { success: true, data: { user: adminUser } } }]);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signed in'));

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(screen.getByTestId('state')).toHaveTextContent('signed out');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('survives localStorage being unavailable', () => {
    // Private browsing can throw on access; the session should still work in
    // memory rather than the app failing to start.
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() =>
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      ),
    ).not.toThrow();

    getItem.mockRestore();
  });
});

describe('useAuth', () => {
  it('fails loudly when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow(/AuthProvider/);

    vi.restoreAllMocks();
  });
});

describe('ProtectedRoute', () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<p>Login page</p>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<p>Secret showroom</p>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  it('redirects to the login page when signed out', async () => {
    mockFetchSequence([]);

    renderAt('/');

    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument());
  });

  it('shows a placeholder while the stored token is being checked, not the login page', async () => {
    // Otherwise a refresh bounces an authenticated user to /login for a frame.
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    mockFetchSequence([{ status: 200, body: { success: true, data: { user: adminUser } } }]);

    renderAt('/');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Secret showroom')).toBeInTheDocument());
  });
});
