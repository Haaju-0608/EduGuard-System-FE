import { useEffect, useRef } from 'react';
import { reportBrowserViolation } from '../services/schoolAdminApi';
import type { BrowserViolationType } from '../types/termination';

const COOLDOWN_MS = 3000;

// Nếu học sinh ở ngoài fullscreen liên tục quá khoảng này mà không quay lại, hệ thống sẽ tự báo
// cáo dồn dập (bỏ qua cooldown) để nhanh chóng chạm ngưỡng 3 vi phạm mà BE đã có sẵn (xem
// BrowserViolationService.cs — TerminationThreshold = 3) và bị disqualify. Không phải "quá 5s là
// disqualify ngay lập tức" (BE không có API riêng cho việc đó, và ta không tự ý sửa BE), mà là
// "quá 5s thì escalate liên tục sau mỗi ESCALATION_INTERVAL_MS cho tới khi chạm ngưỡng có sẵn" —
// đóng lỗ hổng học sinh thoát fullscreen 1 lần rồi ở ngoài bao lâu tùy ý để tra cứu tài liệu.
const PROLONGED_EXIT_THRESHOLD_MS = 5000;
const ESCALATION_INTERVAL_MS = 1500;

/**
 * Phát hiện hành vi rời khỏi màn hình thi và báo cáo lên BE:
 * - visibilitychange (tab ẩn)   → TabSwitch
 * - blur (mất focus cửa sổ)     → WindowBlur
 * - fullscreenchange (thoát FS) → ExitFullscreen (+ escalate nếu ở ngoài quá lâu — xem trên)
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
  const terminatedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    terminatedRef.current = false;

    let escalationTimer: number | undefined;
    let escalationInterval: number | undefined;

    const clearEscalation = () => {
      window.clearTimeout(escalationTimer);
      window.clearInterval(escalationInterval);
      escalationTimer = undefined;
      escalationInterval = undefined;
    };

    const report = (type: BrowserViolationType, options: { bypassCooldown?: boolean } = {}) => {
      if (terminatedRef.current) return;

      const pid = participationIdRef.current;
      if (!pid) {
        // participationId chưa sẵn sàng (vd exam chưa join xong ở BE) — không có gì để gửi kèm nên
        // bỏ qua, nhưng log lại vì đây là nguyên nhân phổ biến khiến violation "im lặng" hoàn toàn.
        console.warn(`[useBrowserViolation] Skipped reporting ${type} — no participationId yet.`);
        return;
      }

      const now = Date.now();
      const last = lastReportedAtRef.current[type] ?? 0;
      if (!options.bypassCooldown && now - last < COOLDOWN_MS) return;
      lastReportedAtRef.current[type] = now;

      reportBrowserViolation({ participationId: pid, violationType: type })
        .then((res) => {
          if (res.examTerminated) {
            terminatedRef.current = true;
            clearEscalation();
          }
          onReportedRef.current?.(res.currentViolationCount, res.examTerminated);
        })
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
      if (document.fullscreenElement) {
        // Đã quay lại fullscreen — hủy hẹn giờ escalate đang chờ (nếu có).
        clearEscalation();
        return;
      }

      report('ExitFullscreen');

      // Ở ngoài fullscreen quá PROLONGED_EXIT_THRESHOLD_MS mà chưa quay lại → bắt đầu báo cáo dồn
      // dập (bỏ qua cooldown) mỗi ESCALATION_INTERVAL_MS cho tới khi bị terminate hoặc quay lại
      // fullscreen — không cho phép "thoát 1 lần rồi ở ngoài vô thời hạn" chỉ tốn đúng 1 violation.
      clearEscalation();
      escalationTimer = window.setTimeout(() => {
        if (document.fullscreenElement || terminatedRef.current) return;
        escalationInterval = window.setInterval(() => {
          if (document.fullscreenElement || terminatedRef.current) {
            clearEscalation();
            return;
          }
          report('ExitFullscreen', { bypassCooldown: true });
        }, ESCALATION_INTERVAL_MS);
      }, PROLONGED_EXIT_THRESHOLD_MS);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearEscalation();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [enabled]);
}
