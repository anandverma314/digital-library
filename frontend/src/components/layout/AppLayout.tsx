import { BarChart3, BookOpen, IndianRupee, LayoutDashboard, LogOut, Menu, Receipt, Settings, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { Avatar, LoadingState } from '@/components/common';
import { useAuth, useIsAdmin } from '@/lib/auth/AuthContext';
import { LIBRARY_NAME, LIBRARY_SHORT_NAME } from '@/lib/constants';
import { useMediaQuery } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/fees', label: 'Fees', icon: IndianRupee },
  { to: '/payments', label: 'Payments', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/users', label: 'Users', icon: ShieldCheck, adminOnly: true },
];

/** Remembers whether the desktop sidebar is open; storage can be unavailable, so failures are ignored. */
const SIDEBAR_KEY = 'dl_sidebar_open';
function readSidebarPref(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== 'false';
  } catch {
    return true;
  }
}
function saveSidebarPref(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, String(open));
  } catch {
    // ignore
  }
}

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
        <BookOpen className="size-4" />
      </div>
      <p className="truncate text-sm font-bold text-slate-900">
        {LIBRARY_SHORT_NAME}
        <span className="hidden font-normal text-slate-500 sm:inline"> · Digital Library</span>
      </p>
    </div>
  );
}

/** `collapsed` (desktop only) shows just the icons; the label stays available to screen readers and as a tooltip. */
function NavItems({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const isAdmin = useIsAdmin();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.filter((n) => isAdmin || !n.adminOnly).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive ? 'bg-primary-soft text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          <Icon className="size-5 shrink-0" />
          <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
        <p className="truncate text-xs text-slate-500">{user.role === 'admin' ? 'Admin' : 'User'}</p>
      </div>
      <Avatar name={user.name} size="sm" />
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-5" />
      </button>
    </div>
  );
}

/**
 * Shell for signed-in pages: fixed top bar with the menu button, and a sidebar of icon + label links.
 * Desktop: the sidebar pushes the content and collapses to an icon-only strip. Mobile: it floats over the content.
 * Redirects to /login when there is no session.
 */
export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [desktopOpen, setDesktopOpen] = useState(readSidebarPref);
  const [mobileOpen, setMobileOpen] = useState(false);
  const open = isDesktop ? desktopOpen : mobileOpen;
  const collapsed = isDesktop && !desktopOpen;

  useEffect(() => setMobileOpen(false), [location.pathname, isDesktop]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  if (user === undefined) return <LoadingState label="Checking your session…" />;
  if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  const toggle = () => {
    if (!isDesktop) return setMobileOpen((v) => !v);
    setDesktopOpen((v) => {
      saveSidebarPref(!v);
      return !v;
    });
  };

  return (
    <div className="min-h-dvh">
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:px-4">
        <button
          type="button"
          onClick={toggle}
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="app-sidebar"
        >
          <Menu className="size-5" />
        </button>
        <Brand />
        <div className="ml-auto">
          <UserMenu />
        </div>
      </header>

      {/* Mobile: dim the page behind the floating sidebar; tapping it closes the menu. */}
      {!isDesktop && mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-30 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside
        id="app-sidebar"
        inert={!isDesktop && !mobileOpen}
        className={cn(
          'fixed bottom-0 left-0 top-14 z-40 overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white py-4 transition-[width,transform] duration-200',
          collapsed ? 'w-16 px-2' : 'w-60 px-3',
          !isDesktop && (mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'),
        )}
      >
        <NavItems collapsed={collapsed} onNavigate={isDesktop ? undefined : () => setMobileOpen(false)} />
      </aside>

      <div className={cn('pt-14 transition-[padding] duration-200', isDesktop && (desktopOpen ? 'pl-60' : 'pl-16'))}>
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Centered card layout for the login page. Signed-in users are sent to the dashboard. */
export function AuthLayout() {
  const { user } = useAuth();
  if (user === undefined) return <LoadingState />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
          <BookOpen className="size-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{LIBRARY_NAME}</h1>
          <p className="text-sm text-slate-500">Admin panel</p>
        </div>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Outlet />
      </div>
    </div>
  );
}
