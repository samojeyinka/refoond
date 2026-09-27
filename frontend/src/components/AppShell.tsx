import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Moon, Package, ReceiptText, Scale, Sun } from 'lucide-react';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/cn';

export default function AppShell() {
  const { me, isAdmin, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const links = isAdmin
    ? [{ to: '/admin', label: 'Review queue', icon: Scale }]
    : [
        { to: '/orders', label: 'My orders', icon: Package },
        { to: '/refunds', label: 'My refunds', icon: ReceiptText },
      ];

  async function signOut() {
    setProfileMenuOpen(false);
    await logout();
    navigate('/', { replace: true });
  }

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f0e8] dark:bg-[#111713]">
      <header className="sticky top-0 z-20 border-b border-[#1d241f]/10 bg-[#f4f0e8]/90 backdrop-blur-md dark:border-white/10 dark:bg-[#111713]/90">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:h-[72px] sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0">
          <NavLink to="/" className="flex shrink-0 items-center">
            <span className="font-brand text-2xl font-black tracking-[-0.09em] text-[#1d241f] dark:text-white">
              refoond<span className="text-[#e86438]">.</span>
            </span>
          </NavLink>

          <nav className="order-3 flex w-full items-center justify-center rounded-full border border-[#1d241f]/10 bg-white/55 p-1 dark:border-white/10 dark:bg-white/5 sm:order-none sm:ml-5 sm:w-auto" aria-label="Main">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  cn(
                    'inline-flex w-full text-nowrap justify-center  min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all sm:gap-2 sm:px-4 sm:text-sm',
                    isActive
                      ? 'bg-[#1d241f] text-white shadow-sm dark:bg-[#f4f0e8] dark:text-[#1d241f]'
                      : 'text-[#657068] hover:bg-white hover:text-[#1d241f] dark:text-[#c4c9c3] dark:hover:bg-white/10 dark:hover:text-white',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>


          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} className="gap-1.5 rounded-full border border-[#1d241f]/10 px-3 dark:border-white/10">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
             
            </Button>
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                aria-label="Open account menu"
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="flex size-9 items-center justify-center rounded-full border border-[#1d241f]/10 bg-white/60 transition hover:border-[#e86438] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e86438] focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Avatar name={me?.fullName ?? 'User'} size="sm" />
                <ChevronDown className="sr-only" aria-hidden="true" />
              </button>
              {profileMenuOpen ? (
                <div role="menu" className="absolute right-0 top-[calc(100%+0.6rem)] z-30 w-56 rounded-2xl border border-[#1d241f]/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#1d241f]">
                  <div className="border-b border-[#1d241f]/10 px-3 py-2.5 dark:border-white/10">
                    <p className="truncate text-sm font-semibold text-[#1d241f] dark:text-white">{me?.fullName ?? 'User'}</p>
                    <p className="mt-0.5 truncate text-xs text-[#657068] dark:text-[#c4c9c3]">{me?.email}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#e86438]">{isAdmin ? 'Support staff' : 'Customer'}</p>
                  </div>
                  <button type="button" role="menuitem" onClick={() => void signOut()} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">
                    <LogOut className="size-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-[#1d241f]/10 py-4 dark:border-white/10">
        <p className="mx-auto w-full max-w-7xl px-4 text-xs font-medium text-[#657068] sm:px-6 dark:text-[#c4c9c3]">
          refoond · customer support refund system.
        </p>
      </footer>

    </div>
  );
}
