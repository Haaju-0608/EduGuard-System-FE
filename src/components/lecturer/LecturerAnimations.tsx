/**
 * Animation primitives — stagger, fade-in, scan beam, floating orbs
 */
import React, { ReactNode, useEffect, useState } from 'react';

/** Fade + slide vào — delay theo index */
export function AnimateIn({
  children,
  index = 0,
  className = '',
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const delay = Math.min(index * 0.07, 0.45);
  return (
    <div
      className={`animate-stagger-in ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

/** Grid con — mỗi child stagger theo thứ tự */
export function StaggerGrid({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'section';
}) {
  return (
    <Tag className={className}>
      {React.Children.map(children, (child, i) =>
        child ? <AnimateIn index={i}>{child}</AnimateIn> : null
      )}
    </Tag>
  );
}

/** Progress bar animate width khi mount */
export function AnimatedProgressBar({
  rate,
  gradientClass,
  label = 'Attendance Rate',
}: {
  rate: number;
  gradientClass: string;
  label?: string;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = requestAnimationFrame(() => setWidth(rate));
    return () => cancelAnimationFrame(t);
  }, [rate]);

  const colorClass =
    rate >= 80 ? 'text-green' : rate >= 60 ? 'text-gold' : 'text-red';

  return (
    <div className="attendance-progress">
      <div className="flex justify-between mb-1.5">
        <span className="text-[11px] text-muted">{label}</span>
        <span className={`text-xs font-bold ${colorClass}`}>{rate}%</span>
      </div>
      <div className="attendance-progress-track">
        <div
          className={`attendance-progress-fill bg-linear-to-r ${gradientClass} transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** Orbs nổi nhẹ trong banner */
export function FloatingOrbs({ color = '#2563EB' }: { color?: string }) {
  return (
    <>
      <div
        className="absolute w-40 h-40 rounded-full blur-3xl opacity-20 animate-orb-drift pointer-events-none"
        style={{ background: color, top: '-20%', right: '10%' }}
      />
      <div
        className="animate-orb-drift-reverse absolute w-28 h-28 rounded-full blur-2xl opacity-15 pointer-events-none"
        style={{ background: '#06B6D4', bottom: '-10%', left: '5%' }}
      />
    </>
  );
}

/** Tia quét camera (di chuyển dọc) */
export function CameraScanBeam({ active = true }: { active?: boolean }) {
  if (!active) return null;
  return <div className="proctor-scan-beam" aria-hidden />;
}

/** Pulse dot — live / recording */
export function LiveDot({ color = 'bg-red' }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

/** Modal backdrop + scale in */
export function ModalOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-fast"
      onClick={onClose}
    >
      <div className="animate-scale-in w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Shimmer skeleton row */
export function SkeletonRows({ count = 4, height = 'h-20' }: { count?: number; height?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`uni-skeleton rounded-xl ${height}`}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </>
  );
}
