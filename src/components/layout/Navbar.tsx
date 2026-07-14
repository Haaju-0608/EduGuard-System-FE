import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NAV_LINKS } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth, getDashboardPath } from '../../contexts/AuthContext';
import { FiSun, FiMoon, FiLogOut, FiUser } from 'react-icons/fi';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDashboard = () => {
    if (user) {
      navigate(getDashboardPath(user.role));
    }
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between px-[5vw] h-[68px] bg-nav-bg backdrop-blur-[18px] border-b border-border"
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-[10px] font-syne font-extrabold text-[1.25rem] text-white-soft no-underline">
        <div className="w-[34px] h-[34px] bg-linear-to-br from-blue to-cyan rounded-[9px] grid place-items-center text-[1rem]">
          🛡️
        </div>
        EduGuard
      </Link>

      {/* Nav Links */}
      <ul className="nav-links-responsive flex gap-[2.2rem] list-none">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="text-muted no-underline text-[0.9rem] font-medium transition-colors duration-200 hover:text-white-soft"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      {/* CTA Buttons */}
      <div className="flex gap-3 items-center">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="w-[36px] h-[36px] rounded-full bg-transparent border border-border text-white-soft flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-cyan hover:bg-cyan-glow mr-1"
        >
          {theme === 'light' ? <FiMoon className="text-[1.1rem]" /> : <FiSun className="text-[1.1rem]" />}
        </button>

        {isAuthenticated ? (
          <>
            {/* Dashboard Button */}
            <button
              onClick={handleDashboard}
              className="flex items-center gap-2 bg-transparent border border-border text-white-soft py-[0.45rem] px-[1.2rem] rounded-[8px] text-[0.88rem] cursor-pointer font-dm font-medium transition-all duration-200 hover:border-cyan hover:bg-cyan-glow"
            >
              <FiUser className="text-sm" />
              Dashboard
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-transparent border border-red/30 text-red/80 py-[0.45rem] px-[1.2rem] rounded-[8px] text-[0.88rem] cursor-pointer font-dm font-medium transition-all duration-200 hover:border-red hover:bg-red/10 hover:text-red"
            >
              <FiLogOut className="text-sm" />
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="bg-transparent border border-border text-white-soft py-[0.45rem] px-[1.2rem] rounded-[8px] text-[0.88rem] cursor-pointer font-dm font-medium transition-all duration-200 hover:border-cyan hover:bg-cyan-glow no-underline inline-flex items-center"
            >
              Sign In
            </Link>
            <button
              className="bg-linear-to-br from-blue to-cyan border-none text-white py-[0.5rem] px-[1.4rem] rounded-[8px] text-[0.88rem] cursor-pointer font-dm font-semibold shadow-[0_0_22px_rgba(37,99,235,0.5)] transition-all duration-200 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] hover:-translate-y-[1px]"
            >
              Contact Us
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
