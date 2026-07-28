import { useEffect, useRef } from 'react';
import { reportBrowserViolation } from '../services/schoolAdminApi';
import type { BrowserViolationType } from '../types/termination';

const COOLDOWN_MS = 3000;

/**
 * Phát hiện hành vi rời khỏi màn hình thi và báo cáo lên BE:
 * - visibilitychange (tab ẩn)   → TabSwitch
 * - blur (mất focus cửa sổ)     → WindowBlur
 * - fullscreenchange (thoát FS) → ExitFullscreen
 *
 * Có cooldown riêng theo từng loại để tránh spam report khi user bấm liên tục (vd alt-tab nhiều lần).
 * Tự tắt hoàn toàn (không gắn listener) khi `enabled=false` — dùng để dừng detect khi bài thi đã
 * kết thúc/bị terminate.
 *
 * `onReported` — gọi ngay khi có response từ BE (currentViolationCount, examTerminated). Response
 * POST đã có examTerminated ngay lập tức, nên đây là tín hiệu terminate nhanh/chắc nhất, không cần
 * đợi SignalR.
 */
export function useBrowserViolation(
  participationId: string | null,
  enabled: boolean,
  onReported?: (currentViolationCount: number, examTerminated: boolean) => void,
): void {
  const participationIdRef = useRef(participationId);
  participationIdRef.current = participationId;

  const onReportedRef = useRef(onReported);
  onReportedRef.current = onReported;

  const lastReportedAtRef = useRef<Partial<Record<BrowserViolationType, number>>>({});

  useEffect(() => {
    if (!enabled) return;

    const report = (type: BrowserViolationType) => {
      const pid = participationIdRef.current;
      if (!pid) {
        // participationId chưa sẵn sàng (vd exam chưa join xong ở BE) — không có gì để gửi kèm nên
        // bỏ qua, nhưng log lại vì đây là nguyên nhân phổ biến khiến violation "im lặng" hoàn toàn.
        console.warn(`[useBrowserViolation] Skipped reporting ${type} — no participationId yet.`);
        return;
      }

      const now = Date.now();
      const last = lastReportedAtRef.current[type] ?? 0;
      if (now - last < COOLDOWN_MS) return;
      lastReportedAtRef.current[type] = now;

      reportBrowserViolation({ participationId: pid, violationType: type })
        .then((res) => onReportedRef.current?.(res.currentViolationCount, res.examTerminated))
        .catch((err) => {
          // Không chặn thi nếu report lỗi, nhưng PHẢI log ra — trước đây nuốt lỗi hoàn toàn khiến
          // không thể phân biệt được "chưa gửi" (bug FE) với "gửi rồi nhưng BE từ chối" (403/500...).
          console.warn(`[useBrowserViolation] Failed to report ${type}:`, err);
        });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) report('TabSwitch');
    };
    const handleBlur = () => report('WindowBlur');
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) report('ExitFullscreen');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [enabled]);
}
