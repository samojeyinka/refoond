import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Package, ReceiptText, Scale, Sun } from 'lucide-react';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/cn';

export default function AppShell() {
  const { me, isAdmin, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const links = isAdmin
    ? [{ to: '/admin', label: 'Review queue', icon: Scale }]
    : [
        { to: '/orders', label: 'My orders', icon: Package },
        { to: '/refunds', label: 'My refunds', icon: ReceiptText },
      ];

  async function signOut() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f0e8] dark:bg-[#111713]">
      <header className="sticky top-0 z-20 border-b border-[#1d241f]/10 bg-[#f4f0e8]/90 backdrop-blur-md dark:border-white/10 dark:bg-[#111713]/90">
        <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center">
            <span className="font-brand text-2xl font-black tracking-[-0.09em] text-[#1d241f] dark:text-white">
              refoond<span className="text-[#e86438]">.</span>
            </span>
          </NavLink>

          <nav className="ml-2 flex items-center rounded-full border border-[#1d241f]/10 bg-white/55 p-1 dark:border-white/10 dark:bg-white/5 sm:ml-5" aria-label="Main">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all sm:px-4 sm:text-sm',
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


          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle colour theme" className="rounded-full border border-[#1d241f]/10 dark:border-white/10">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <div className="hidden items-center gap-2.5 border-l border-[#1d241f]/10 pl-3 sm:flex dark:border-white/10">
              <Avatar name={me?.fullName ?? 'User'} size="sm" />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-[#1d241f] dark:text-white">{me?.fullName}</p>
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#657068] dark:text-[#c4c9c3]">
                  {isAdmin ? 'Support staff' : 'Customer'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} className="rounded-full">
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </Button>
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
