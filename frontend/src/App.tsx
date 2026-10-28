import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.js';
import { ToastProvider } from './context/ToastProvider.js';
import { Navbar } from './components/layout/Navbar.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { PurchasesPage } from './pages/PurchasesPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

/**
 * Route table.
 *
 * Everything meaningful sits behind <ProtectedRoute>, which matches the API:
 * the vehicle endpoints all require a token, so an anonymous visitor has
 * nothing to show.
 */
export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex min-h-screen flex-col">
          {/*
            First thing in the tab order: a keyboard user should not have to
            tab through the whole navbar on every page to reach the content.
            Visually hidden until it has focus.
          */}
          <a
            href="#main-content"
            className="sr-only z-50 rounded-lg bg-brand-500 px-4 py-2 font-semibold text-ink-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
          >
            Skip to content
          </a>

          <Navbar />

          <main id="main-content" className="flex-1">
            {/*
              Inside the router, so a crash in one page leaves the navigation
              usable instead of blanking the entire app.
            */}
            <ErrorBoundary>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/purchases" element={<PurchasesPage />} />
                </Route>

                {/* A real 404 rather than a silent redirect, which would hide
                    typos and broken links. */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ErrorBoundary>
          </main>

          <footer className="border-t border-ink-700/60 py-6">
            <p className="text-center text-xs text-ink-500">
              Apex Motors - a TDD kata build. React, Tailwind, Express and SQLite.
            </p>
          </footer>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
