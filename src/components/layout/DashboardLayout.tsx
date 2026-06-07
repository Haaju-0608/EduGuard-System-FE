import React, { useState, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { FiSun, FiMoon, FiMenu, FiChevronLeft, FiLogOut, FiBell, FiSearch } from 'react-icons/fi';
import { CampusBackground, AcademySeal } from '../lecturer/LecturerUI';
import { getFacultyByDepartment, getFacultyTheme } from '../../utils/facultyTheme';
import NotificationPanel from '../feedback/NotificationPanel';
import { useNotifications } from '../../contexts/NotificationContext';

export interface MenuItem {
  icon: string | ReactNode;
  label: string;
  path: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  menuItems?: MenuItem[];
  /** Bật ảnh nền campus cho portal giảng viên */
  campusMode?: boolean;
}

export default function DashboardLayout({ children, menuItems = [], campusMode = false }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const lecturerFaculty = campusMode && user?.department
    ? getFacultyTheme(getFacultyByDepartment(user.department))
    : null;

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden bg-navy">
      {/* ── SIDEBAR ── */}
      <aside
        className={`sidebar-transition fixed top-0 left-0 lg:relative lg:top-auto lg:left-auto z-50 h-full flex flex-col bg-navy-card border-r border-border
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Area */}
        <div className={`flex items-center h-[68px] border-b border-border px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link to="/" className="flex items-center gap-[10px] no-underline">
            {campusMode ? (
              <AcademySeal size="sm" />
            ) : (
              <div className="w-[34px] h-[34px] min-w-[34px] bg-linear-to-br from-blue to-cyan rounded-[9px] grid place-items-center text-[1rem]">
                🛡️
              </div>
            )}
            {!collapsed && (
              <div>
                <span className="font-syne font-extrabold text-[1.1rem] text-white-soft block leading-tight">EduGuard</span>
                {campusMode && (
                  <span className="text-[10px] text-cyan font-semibold tracking-wide">
                    Faculty Portal{lecturerFaculty ? ` · ${lecturerFaculty.shortName}` : ''}
                  </span>
                )}
              </div>
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
              const rootPaths = ['/lecture', '/admin', '/profile'];
              const isActive =
                location.pathname === item.path ||
                (!rootPaths.includes(item.path) && location.pathname.startsWith(item.path));
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
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0 w-full lg:w-auto max-w-full overflow-x-hidden">
        {/* Top Header — z cao để dropdown thông báo nổi trên content */}
        <header className="sticky top-0 z-[100] shrink-0 h-[68px] flex items-center justify-between px-6 border-b border-border bg-navy-card/50 backdrop-blur-[12px] overflow-visible">
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

            {/* Notifications — dropdown kiểu social */}
            <div className="relative z-[110]">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className={`relative w-[36px] h-[36px] rounded-full bg-transparent border text-white-soft flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-cyan hover:bg-cyan-glow
                  ${notifOpen ? 'border-cyan bg-cyan-glow' : 'border-border'}
                `}
              >
                <FiBell className="text-[1.05rem]" />
                {unreadCount > 0 && (
                  <span className="notif-badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            {/* Avatar */}
            <div className="w-[36px] h-[36px] rounded-full bg-linear-to-br from-blue to-cyan grid place-items-center text-white text-xs font-syne font-bold cursor-pointer">
              {user?.initials || '??'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 overflow-y-visible lg:overflow-y-auto p-6 custom-scrollbar relative z-0 min-h-0 ${campusMode ? 'lecture-main-campus' : ''}`}>
          {campusMode && <CampusBackground />}
          <div className="relative z-[1]">{children}</div>
        </main>
      </div>
    </div>
  );
}
