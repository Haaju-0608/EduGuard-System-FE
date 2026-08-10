import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiChevronDown } from 'react-icons/fi';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** 'default' = filter bar style | 'inline' = compact badge/pill style */
  variant?: 'default' | 'inline';
  /** Color class applied to the badge trigger (inline variant) */
  colorClass?: string;
}

export default function CustomSelect({
  value, onChange, options, placeholder = 'Select…', disabled = false,
  className = '', variant = 'default', colorClass = '',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, flipUp: false });

  const MAX_LIST_HEIGHT = 240;

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;

  // `listHeight` mặc định giả định MAX_LIST_HEIGHT (240px) — dùng để quyết định lật lên hay
  // không TRƯỚC khi list kịp render (chưa đo được chiều cao thật). Sau khi render xong, effect
  // bên dưới đo chiều cao THẬT rồi gọi lại hàm này với giá trị chính xác — quan trọng cho list
  // ít lựa chọn (vd 2 option) vì lúc đó list ngắn hơn 240px rất nhiều, nếu cứ trừ nguyên 240px
  // khi lật lên thì nó bị đẩy lên cao hơn hẳn vị trí đúng, đè lên các field khác phía trên.
  const calcPos = (listHeight = MAX_LIST_HEIGHT) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < listHeight && rect.top > listHeight;
    return {
      top: flipUp
        ? rect.top + window.scrollY - listHeight - 4
        : rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 160),
      flipUp,
    };
  };

  const openDropdown = () => {
    if (disabled) return;
    const p = calcPos();
    if (!p) return;
    setPos(p);
    setOpen(true);
  };

  const toggleDropdown = () => {
    if (open) { setOpen(false); return; }
    openDropdown();
  };

  const select = (val: string) => { onChange(val); setOpen(false); };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Reposition on scroll / resize
  useEffect(() => {
    if (!open) return;
    const update = () => { const p = calcPos(); if (p) setPos(p); };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  // Đo chiều cao THẬT của list ngay sau khi render (useLayoutEffect để sửa trước khi vẽ lên màn
  // hình, tránh nháy vị trí) rồi tính lại vị trí lật lên cho đúng — xem giải thích ở calcPos.
  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const actualHeight = listRef.current.getBoundingClientRect().height;
    const p = calcPos(actualHeight);
    if (p) setPos(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Trigger style ──────────────────────────────────────────────────────

  const defaultTrigger = `flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm cursor-pointer transition-all select-none ${
    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-bright/40'
  } bg-navy-card border-border text-white-soft ${className}`;

  const inlineTrigger = `flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer select-none transition-all ${
    disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
  } ${colorClass} ${className}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        className={variant === 'inline' ? inlineTrigger : defaultTrigger}
      >
        <span className="truncate">{selectedLabel}</span>
        <FiChevronDown className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${variant === 'inline' ? 'text-[10px]' : 'text-sm text-muted'}`} />
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          style={{ top: pos.top, left: pos.left, minWidth: pos.width, maxHeight: '240px' }}
          className="fixed z-[9999] bg-[#0f172a] border border-border rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-y-auto py-1.5 custom-scrollbar"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => select(opt.value)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-left cursor-pointer transition-colors border-none ${
                  isSelected
                    ? 'bg-blue/15 text-blue-bright font-semibold'
                    : 'text-white-soft hover:bg-white/5'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <FiCheck className="text-blue-bright shrink-0 text-xs" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
