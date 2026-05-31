import React, { useState, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { FiSun, FiMoon, FiMenu, FiChevronLeft, FiLogOut, FiBell, FiSearch } from 'react-icons/fi';

export interface MenuItem {
  icon: string | ReactNode;
  label: string;
  path: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  menuItems?: MenuItem[];
}

export default function DashboardLayout({ children, menuItems = [] }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-navy">
      {/* ── SIDEBAR ── */}
      <aside
        className={`sidebar-transition fixed lg:relative z-50 h-full flex flex-col bg-navy-card border-r border-border
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Area */}
        <div className={`flex items-center h-[68px] border-b border-border px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link to="/" className="flex items-center gap-[10px] no-underline">
            <div className="w-[34px] h-[34px] min-w-[34px] bg-linear-to-br from-blue to-cyan rounded-[9px] grid place-items-center text-[1rem]">
              🛡️
            </div>
            {!collapsed && (
              <span className="font-syne font-extrabold text-[1.1rem] text-white-soft">EduGuard</span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-[28px] h-[28px] rounded-lg bg-navy border border-border text-muted items-center justify-center cursor-pointer hover:text-white-soft hover:border-cyan transition-all"
          >
            <FiChevronLeft className={`text-sm transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-xl py-2.5 px-3 no-underline font-dm text-sm font-medium transition-all duration-200 group
                    ${isActive
                      ? 'bg-blue/15 text-blue-bright border border-blue/25 shadow-[0_0_16px_rgba(37,99,235,0.1)]'
                      : 'text-muted hover:text-white-soft hover:bg-navy/60 border border-transparent'
                    }
                    ${collapsed ? 'justify-center px-0' : ''}
                  `}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`text-lg min-w-[24px] text-center ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Info & Logout */}
        <div className={`border-t border-border p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          {!collapsed && (
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-[38px] h-[38px] min-w-[38px] rounded-full bg-linear-to-br from-blue to-cyan grid place-items-center text-white text-sm font-syne font-bold">
                {user?.initials || '??'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-white-soft truncate">{user?.name}</p>
                <p className="text-[11px] text-muted truncate">{user?.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 w-full rounded-xl py-2.5 px-3 text-sm font-medium text-red/80 hover:text-red hover:bg-red/10 border border-transparent hover:border-red/20 transition-all cursor-pointer bg-transparent
              ${collapsed ? 'justify-center px-0' : ''}
            `}
            title="Logout"
          >
            <FiLogOut className="text-lg" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-[68px] flex items-center justify-between px-6 border-b border-border bg-navy-card/50 backdrop-blur-[12px]">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-[36px] h-[36px] rounded-lg bg-transparent border border-border text-white-soft flex items-center justify-center cursor-pointer hover:border-cyan transition-all"
            >
              <FiMenu />
            </button>

            {/* Search bar */}
            <div className="hidden md:flex items-center gap-2 bg-navy border border-border rounded-xl py-2 px-3.5 w-[280px] focus-within:border-blue-bright/40 transition-colors">
              <FiSearch className="text-muted text-sm" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted w-full font-dm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="w-[36px] h-[36px] rounded-full bg-transparent border border-border text-white-soft flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-cyan hover:bg-cyan-glow"
            >
              {theme === 'light' ? <FiMoon className="text-[1.05rem]" /> : <FiSun className="text-[1.05rem]" />}
            </button>

            {/* Notifications */}
            <button className="relative w-[36px] h-[36px] rounded-full bg-transparent border border-border text-white-soft flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-cyan hover:bg-cyan-glow">
              <FiBell className="text-[1.05rem]" />
              <span className="absolute -top-0.5 -right-0.5 w-[8px] h-[8px] bg-red rounded-full border-2 border-navy-card" />
            </button>

            {/* Avatar */}
            <div className="w-[36px] h-[36px] rounded-full bg-linear-to-br from-blue to-cyan grid place-items-center text-white text-xs font-syne font-bold cursor-pointer">
              {user?.initials || '??'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
