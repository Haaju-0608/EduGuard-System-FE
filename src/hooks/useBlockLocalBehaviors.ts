import { useEffect } from 'react';

/** Các phím tắt mở DevTools / view-source cần chặn trong lúc thi */
const BLOCKED_KEY_COMBOS: Array<(e: KeyboardEvent) => boolean> = [
  (e) => e.key === 'F12',
  (e) => e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i',
  (e) => e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'j',
  (e) => e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c',
  (e) => e.ctrlKey && e.key.toLowerCase() === 'u',
];

/**
 * Chặn các hành vi CỤC BỘ trong lúc làm bài (copy/paste/cut/menu chuột phải/kéo-thả/DevTools) —
 * chỉ preventDefault, KHÔNG báo cáo lên BE (khác với useBrowserViolation, vốn theo dõi hành vi
 * rời màn hình thi và report vi phạm thật sự).
 */
export function useBlockLocalBehaviors(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const preventDefault = (e: Event) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (BLOCKED_KEY_COMBOS.some((matches) => matches(e))) {
        e.preventDefault();
      }
    };

    document.addEventListener('copy', preventDefault);
    document.addEventListener('paste', preventDefault);
    document.addEventListener('cut', preventDefault);
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('dragstart', preventDefault);
    document.addEventListener('drop', preventDefault);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('paste', preventDefault);
      document.removeEventListener('cut', preventDefault);
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('dragstart', preventDefault);
      document.removeEventListener('drop', preventDefault);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}
