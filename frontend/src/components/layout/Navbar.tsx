import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../ui/Button.js';
import { initials } from '../../lib/format.js';

/** Top navigation. Shows the admin badge and the links the role can use. */
export function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex items-center gap-2.5" aria-label="Apex Motors home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-ink-950">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
            </svg>
          </span>
          <span className="hidden text-lg font-semibold tracking-tight sm:block">
            Apex<span className="text-brand-400">Motors</span>
          </span>
        </NavLink>

        {user ? (
          <>
            <nav className="flex items-center gap-1" aria-label="Main">
              <NavItem to="/">Showroom</NavItem>
              <NavItem to="/purchases">My purchases</NavItem>
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2.5 sm:flex">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full border border-ink-600 bg-ink-800 text-xs font-semibold text-ink-200"
                  aria-hidden="true"
                >
                  {initials(user.name)}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-ink-100">{user.name}</p>
                  <p className="text-[11px] uppercase tracking-wider text-brand-400">
                    {isAdmin ? 'Administrator' : 'Customer'}
                  </p>
                </div>
              </div>

              <Button variant="secondary" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <NavLink to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </NavLink>
            <NavLink to="/register">
              <Button size="sm">Create account</Button>
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive
            ? 'bg-ink-800 text-ink-100'
            : 'text-ink-300 hover:bg-ink-800/60 hover:text-ink-100'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
