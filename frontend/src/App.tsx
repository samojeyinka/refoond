import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppShell from './components/AppShell';
import { Spinner } from './components/ui/Spinner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OrdersPage from './pages/OrdersPage';
import RefundsPage from './pages/RefundsPage';
import AdminQueuePage from './pages/AdminQueuePage';
import NotFoundPage from './pages/NotFoundPage';

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-zinc-950">
      <Spinner className="size-6 text-brand-600" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Blocks a route until the session is known, then sends guests to /login. */
function RequireAuth({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { me, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/orders" replace />;
  return <>{children}</>;
}

/** Keeps the sign-in and sign-up screens away from people who already have a session. */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { me, loading, isAdmin } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (me) return <Navigate to={isAdmin ? '/admin' : '/orders'} replace />;
  return <>{children}</>;
}

/** Sends each role to the surface it actually works in. */
function RoleHome() {
  const { me, loading, isAdmin } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!me) return <LandingPage />;
  return <Navigate to={isAdmin ? '/admin' : '/orders'} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/login"
                element={
                  <RedirectIfAuthed>
                    <LoginPage />
                  </RedirectIfAuthed>
                }
              />
              <Route
                path="/signup"
                element={
                  <RedirectIfAuthed>
                    <SignupPage />
                  </RedirectIfAuthed>
                }
              />

              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/refunds" element={<RefundsPage />} />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth adminOnly>
                      <AdminQueuePage />
                    </RequireAuth>
                  }
                />
                <Route path="/home" element={<RoleHome />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
