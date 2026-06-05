import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { FiSun, FiMoon, FiMail, FiLock, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      toast.warning('Thiếu email', 'Vui lòng nhập địa chỉ email đăng nhập.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.warning('Email không hợp lệ', 'Vui lòng kiểm tra lại định dạng email.');
      return;
    }
    if (!password) {
      toast.warning('Thiếu mật khẩu', 'Vui lòng nhập mật khẩu của bạn.');
      return;
    }
    if (password.length < 6) {
      toast.warning('Mật khẩu quá ngắn', 'Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 600));

    const result = login(email, password);
    if (result.success && result.user) {
      toast.success('Đăng nhập thành công', `Chào mừng trở lại, ${result.user.name}!`);
      const path =
        result.user.role === 'admin'
          ? '/admin'
          : result.user.role === 'lecture'
            ? '/lecture'
            : '/profile';
      navigate(path, { replace: true });
    } else {
      const msg = result.error || 'Email hoặc mật khẩu không đúng.';
      setError(msg);
      toast.error('Đăng nhập thất bại', msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-navy relative overflow-hidden">
      {/* ── LEFT PANEL — Decorative ── */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden">
        {/* Background glow orbs */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full animate-pulse-glow"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 70%)', top: '10%', left: '20%' }}
        />
        <div
          className="absolute w-[350px] h-[350px] rounded-full animate-pulse-glow"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)', bottom: '15%', right: '10%', animationDelay: '2s' }}
        />

        {/* Grid background */}
        <div className="absolute inset-0 hero-grid-bg" />

        {/* Content */}
        <div className="relative z-10 text-center px-12 max-w-[480px]">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="w-[52px] h-[52px] bg-linear-to-br from-blue to-cyan rounded-[14px] grid place-items-center text-[1.5rem] shadow-[0_0_30px_rgba(37,99,235,0.4)]">
              🛡️
            </div>
            <span className="font-syne font-extrabold text-[2rem] text-white-soft">EduGuard</span>
          </div>

          <h1 className="font-syne font-extrabold text-[2.2rem] leading-tight mb-5">
            Welcome to the<br />
            <span className="text-gradient-blue-cyan">Future of Education</span>
          </h1>

          <p className="text-muted text-[1.05rem] leading-relaxed mb-10">
            AI-powered attendance & exam proctoring platform trusted by 300+ organizations worldwide.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {['🎯 Smart Attendance', '👁️ Live Proctoring', '📊 Analytics', '🔐 Secure SSO'].map((f) => (
              <span
                key={f}
                className="bg-navy-card border border-border rounded-full py-1.5 px-4 text-[0.8rem] text-muted font-medium"
              >
                {f}
              </span>
            ))}
          </div>

          {/* Floating badges */}
          <div className="absolute -left-2 top-[30%] bg-navy-card border border-green/30 rounded-xl px-3 py-2 text-[11px] text-green font-semibold shadow-lg animate-float-badge whitespace-nowrap">
            ✅ 99.3% Accuracy
          </div>
          <div className="absolute -right-2 bottom-[20%] bg-navy-card border border-cyan/30 rounded-xl px-3 py-2 text-[11px] text-cyan font-semibold shadow-lg animate-float-badge-delay whitespace-nowrap">
            ⚡ 3s Recognition
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Login Form ── */}
      <div className="flex-1 lg:max-w-[520px] flex items-center justify-center px-6 py-12 relative">
        {/* Theme toggle (top right) */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="absolute top-6 right-6 w-[38px] h-[38px] rounded-full bg-transparent border border-border text-white-soft flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-cyan hover:bg-cyan-glow z-20"
        >
          {theme === 'light' ? <FiMoon className="text-[1.1rem]" /> : <FiSun className="text-[1.1rem]" />}
        </button>

        {/* Back to home */}
        <Link
          to="/"
          className="absolute top-6 left-6 text-muted text-sm font-medium no-underline hover:text-white-soft transition-colors flex items-center gap-1.5 z-20"
        >
          ← Back to Home
        </Link>

        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-[38px] h-[38px] bg-linear-to-br from-blue to-cyan rounded-[10px] grid place-items-center text-[1.1rem]">
              🛡️
            </div>
            <span className="font-syne font-extrabold text-xl text-white-soft">EduGuard</span>
          </div>

          <h2 className="font-syne font-extrabold text-[1.8rem] text-white-soft mb-2">
            Sign In
          </h2>
          <p className="text-muted text-[0.95rem] mb-8">
            Enter your credentials to access your dashboard.
          </p>

          {/* Error message */}
          {error && (
            <div className="bg-red/10 border border-red/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <span className="text-red text-sm">⚠</span>
              <span className="text-red text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Email Address</label>
              <div className="flex items-center gap-3 bg-navy border border-border rounded-xl py-3 px-4 focus-within:border-blue-bright/50 transition-colors">
                <FiMail className="text-muted text-[1rem]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted/50 w-full font-dm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Password</label>
              <div className="flex items-center gap-3 bg-navy border border-border rounded-xl py-3 px-4 focus-within:border-blue-bright/50 transition-colors">
                <FiLock className="text-muted text-[1rem]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted/50 w-full font-dm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="bg-transparent border-none text-muted hover:text-white-soft cursor-pointer transition-colors p-0"
                >
                  {showPassword ? <FiEyeOff className="text-[1rem]" /> : <FiEye className="text-[1rem]" />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-blue cursor-pointer" />
                <span className="text-muted text-sm">Remember me</span>
              </label>
              <a href="#" className="text-blue-bright text-sm font-medium no-underline hover:text-cyan transition-colors">
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-syne font-bold text-[0.95rem] text-white
                bg-linear-to-br from-blue to-cyan border-none cursor-pointer
                shadow-[0_0_28px_rgba(37,99,235,0.4)] transition-all duration-300
                hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] hover:-translate-y-[1px]
                disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <FiArrowRight />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted text-xs font-medium">Demo Accounts</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Demo accounts */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => { setEmail('user@eduguard.com'); setPassword('123456'); setError(''); }}
              className="w-full flex items-center gap-3 bg-navy-card border border-border rounded-xl py-2.5 px-4 cursor-pointer text-left transition-all hover:border-gold/40 hover:bg-gold/5 group"
            >
              <div className="w-[34px] h-[34px] rounded-full bg-gold/15 grid place-items-center text-sm">🎓</div>
              <div>
                <p className="text-sm font-semibold text-white-soft group-hover:text-gold transition-colors">Student Account</p>
                <p className="text-[11px] text-muted">user@eduguard.com / 123456</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setEmail('admin@eduguard.com'); setPassword('admin123'); setError(''); }}
              className="w-full flex items-center gap-3 bg-navy-card border border-border rounded-xl py-2.5 px-4 cursor-pointer text-left transition-all hover:border-blue-bright/40 hover:bg-blue/5 group"
            >
              <div className="w-[34px] h-[34px] rounded-full bg-blue-bright/15 grid place-items-center text-sm">👑</div>
              <div>
                <p className="text-sm font-semibold text-white-soft group-hover:text-blue-bright transition-colors">Admin Account</p>
                <p className="text-[11px] text-muted">admin@eduguard.com / admin123</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setEmail('lecture@eduguard.com'); setPassword('lecture123'); setError(''); }}
              className="w-full flex items-center gap-3 bg-navy-card border border-border rounded-xl py-2.5 px-4 cursor-pointer text-left transition-all hover:border-cyan/40 hover:bg-cyan/5 group"
            >
              <div className="w-[34px] h-[34px] rounded-full bg-cyan/15 grid place-items-center text-sm">👨‍🏫</div>
              <div>
                <p className="text-sm font-semibold text-white-soft group-hover:text-cyan transition-colors">Lecturer Account</p>
                <p className="text-[11px] text-muted">lecture@eduguard.com / lecture123</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
