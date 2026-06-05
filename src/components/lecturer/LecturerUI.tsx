/**
 * Shared UI components — phong cách portal đại học hiện đại cho module Giảng viên
 */
import React, { ReactNode } from 'react';
import campusBg from '../../assets/hero.png';
import {
  FacultyId,
  FacultyTheme,
  getFacultyByCourseCode,
  getFacultyTheme,
} from '../../utils/facultyTheme';
import { AnimateIn, AnimatedProgressBar, FloatingOrbs } from './LecturerAnimations';

/* ── Icon học viện — huy hiệu trường ── */
export function AcademySeal({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-9 h-9', md: 'w-11 h-11', lg: 'w-14 h-14' };
  const iconSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' };
  return (
    <div className={`academy-seal ${sizes[size]} shrink-0`}>
      <span className={iconSizes[size]}>🎓</span>
    </div>
  );
}

/* ── Wrapper trang với ảnh nền campus ── */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="lecture-page-shell max-w-[1400px] mx-auto space-y-6 relative z-10">
      {children}
    </div>
  );
}

/* ── Lớp nền campus — bọc toàn bộ main content ── */
export function CampusBackground() {
  return (
    <>
      <div
        className="campus-bg-image pointer-events-none"
        style={{ backgroundImage: `url(${campusBg})` }}
      />
      <div className="campus-bg-overlay pointer-events-none" />
      <div className="campus-bg-silhouette pointer-events-none" />
    </>
  );
}

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  stats?: { label: string; value: string; icon?: ReactNode }[];
  facultyId?: FacultyId;
}

/** Header trang kiểu portal đại học — có huy hiệu & màu khoa */
export function PageHeader({ eyebrow, title, subtitle, actions, stats, facultyId }: PageHeaderProps) {
  const faculty = facultyId ? getFacultyTheme(facultyId) : null;

  return (
    <AnimateIn>
    <div
      className={`uni-page-banner relative overflow-hidden rounded-[24px] border p-6 sm:p-8 ${faculty ? faculty.cardClass : ''}`}
      style={faculty ? { borderColor: `${faculty.primary}33` } : undefined}
    >
      <div className="absolute inset-0 uni-banner-grid pointer-events-none" />
      <FloatingOrbs color={faculty?.primary} />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="flex items-start gap-4">
          <AcademySeal size="lg" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="uni-eyebrow">{eyebrow}</span>
              {faculty && <FacultyBadge facultyId={faculty.id} size="sm" />}
            </div>
            <h1 className="font-syne font-extrabold text-[1.75rem] sm:text-[2rem] text-white-soft mt-2 leading-tight">
              {title}
            </h1>
            {subtitle && <p className="text-muted text-sm mt-2 max-w-xl">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/60">
          {stats.map((s, i) => (
            <AnimateIn key={s.label} index={i + 1}>
              <div className="uni-stat-pill h-full">
                {s.icon && <span className="text-lg">{s.icon}</span>}
                <div>
                  <p className="font-syne font-extrabold text-lg text-white-soft">{s.value}</p>
                  <p className="text-[11px] text-muted uppercase tracking-wider">{s.label}</p>
                </div>
              </div>
            </AnimateIn>
          ))}
        </div>
      )}
    </div>
    </AnimateIn>
  );
}

/** Badge khoa / ngành với icon */
export function FacultyBadge({
  facultyId,
  size = 'md',
  showIcon = true,
}: {
  facultyId: FacultyId;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}) {
  const faculty = getFacultyTheme(facultyId);
  const Icon = faculty.icon;
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span className={`faculty-badge inline-flex items-center font-bold rounded-full border ${faculty.badgeClass} ${sizeClass}`}>
      {showIcon && <Icon className={size === 'sm' ? 'text-[10px]' : 'text-xs'} />}
      {faculty.shortName}
    </span>
  );
}

/** Icon khoa trong vòng tròn */
export function FacultyIcon({ facultyId, size = 'md' }: { facultyId: FacultyId; size?: 'sm' | 'md' | 'lg' }) {
  const faculty = getFacultyTheme(facultyId);
  const Icon = faculty.icon;
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  const iconSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };

  return (
    <div
      className={`faculty-icon-wrap ${sizes[size]} ${faculty.badgeClass} rounded-xl grid place-items-center shrink-0`}
    >
      <Icon className={`${iconSizes[size]} ${faculty.textClass}`} />
    </div>
  );
}

interface UniCardProps {
  children: ReactNode;
  className?: string;
  facultyId?: FacultyId;
  accent?: 'blue' | 'cyan' | 'green' | 'gold' | 'red' | 'none';
  hover?: boolean;
}

/** Card glassmorphism — tự động lấy màu theo khoa nếu có facultyId */
export function UniCard({ children, className = '', facultyId, accent, hover = true }: UniCardProps) {
  const faculty = facultyId ? getFacultyTheme(facultyId) : null;
  const accentClass = faculty
    ? faculty.cardClass
    : accent
      ? `uni-card-accent-${accent}`
      : 'uni-card-accent-blue';

  return (
    <div className={`uni-card ${accentClass} ${hover ? 'uni-card-hover' : ''} ${faculty ? faculty.glowClass : ''} ${className}`}>
      {children}
    </div>
  );
}

/** Badge mã học phần — màu theo khoa */
export function CourseCodeBadge({
  code,
  facultyId,
  size = 'md',
}: {
  code: string;
  facultyId?: FacultyId;
  size?: 'sm' | 'md' | 'lg';
}) {
  const faculty = facultyId ? getFacultyTheme(facultyId) : getFacultyByCourseCode(code);
  const sizes = { sm: 'text-[10px] px-2 py-0.5', md: 'text-xs px-2.5 py-1', lg: 'text-sm px-3 py-1.5' };

  return (
    <span className={`course-code-badge font-syne font-extrabold tracking-wide ${faculty.badgeClass} ${sizes[size]}`}>
      {code}
    </span>
  );
}

/** Badge học kỳ */
export function SemesterBadge({ semester }: { semester: string }) {
  return (
    <span className="semester-badge text-[10px] font-semibold uppercase tracking-widest">
      {semester}
    </span>
  );
}

/** Thanh lọc khoa — hiển thị tất cả khoa */
export function FacultyFilterBar({
  faculties,
  active,
  onChange,
  counts,
}: {
  faculties: FacultyTheme[];
  active: FacultyId | 'all';
  onChange: (id: FacultyId | 'all') => void;
  counts?: Partial<Record<FacultyId | 'all', number>>;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onChange('all')}
        className={`uni-filter-pill ${active === 'all' ? 'uni-filter-pill-active' : ''}`}
      >
        Tất cả khoa
        {counts?.all !== undefined && <span className="uni-filter-count">{counts.all}</span>}
      </button>
      {faculties.map((f) => {
        const Icon = f.icon;
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`uni-filter-pill flex items-center gap-1.5 ${active === f.id ? 'uni-filter-pill-active' : ''} ${active === f.id ? f.badgeClass : ''}`}
          >
            <Icon className="text-xs" />
            {f.shortName}
            {counts?.[f.id] !== undefined && <span className="uni-filter-count">{counts[f.id]}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="uni-filter-bar flex flex-col sm:flex-row gap-3 p-1">
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <AnimateIn>
      <div className="uni-empty-state text-center py-16 px-6">
        <div className="uni-empty-icon animate-subtle-float">{icon}</div>
        <h3 className="font-syne font-bold text-white-soft text-lg mt-4">{title}</h3>
        {description && <p className="text-muted text-sm mt-2 max-w-sm mx-auto">{description}</p>}
      </div>
    </AnimateIn>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'success' | 'danger' | 'ghost';
  className?: string;
}) {
  const variants = {
    primary: 'uni-btn-primary',
    success: 'uni-btn-success',
    danger: 'uni-btn-danger',
    ghost: 'uni-btn-ghost',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function FilterPills<T extends string>({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`uni-filter-pill ${active === tab.key ? 'uni-filter-pill-active' : ''}`}
        >
          {tab.label}
          {counts?.[tab.key] !== undefined && <span className="uni-filter-count">{counts[tab.key]}</span>}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ icon, title, subtitle, badge }: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h2 className="font-syne font-bold text-lg text-white-soft">{title}</h2>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {badge}
    </div>
  );
}

export function SkeletonCard({ className = 'h-[220px]' }: { className?: string }) {
  return <div className={`uni-skeleton rounded-[20px] ${className}`} />;
}

export function StudentAvatar({
  initials,
  size = 'md',
  variant = 'default',
  facultyId,
}: {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'present' | 'absent';
  facultyId?: FacultyId;
}) {
  const sizes = { sm: 'w-8 h-8 text-[10px]', md: 'w-10 h-10 text-xs', lg: 'w-14 h-14 text-lg' };
  const variants = {
    default: facultyId ? `faculty-avatar-${facultyId}` : 'student-avatar-default',
    present: 'student-avatar-present',
    absent: 'student-avatar-absent',
  };
  return (
    <div className={`student-avatar ${sizes[size]} ${variants[variant]}`}>
      {initials}
    </div>
  );
}

export function AttendanceProgressBar({ rate, facultyId }: { rate: number; facultyId?: FacultyId }) {
  const faculty = facultyId ? getFacultyTheme(facultyId) : null;
  const gradient = rate >= 80
    ? faculty ? faculty.gradient : 'from-green to-cyan'
    : rate >= 60 ? 'from-gold to-orange-400' : 'from-red to-orange-400';

  return <AnimatedProgressBar rate={rate} gradientClass={gradient} />;
}

/** @deprecated Dùng facultyId trực tiếp thay vì hash mã lớp */
export function getCourseAccent(code: string): 'blue' | 'cyan' | 'green' | 'gold' {
  const map: Record<FacultyId, 'blue' | 'cyan' | 'green' | 'gold'> = {
    it: 'blue',
    economics: 'gold',
    business: 'green',
    engineering: 'gold',
    'foreign-lang': 'cyan',
  };
  return map[getFacultyByCourseCode(code).id];
}

export type { FacultyId, FacultyTheme };
