import { useEffect, useRef } from 'react';
import { reportBrowserViolation } from '../services/schoolAdminApi';
import type { BrowserViolationType } from '../types/termination';

const COOLDOWN_MS = 3000;

// Thoát fullscreen trước đây chỉ tính 1 lần (1/3 "mạng"), không có giới hạn thời gian ở ngoài —
// học sinh có thể thoát 1 lần rồi ở ngoài bao lâu tuỳ ý để tra tài liệu, chỉ tốn đúng 1 vi phạm.
// Vá lỗ hổng này hoàn toàn ở FE (BE đã có sẵn ngưỡng "3 vi phạm → disqualify" trong
// BrowserViolationService.cs, không cần API mới): nếu học sinh ở ngoài fullscreen quá
// PROLONGED_EXIT_THRESHOLD_MS mà chưa quay lại, coi là cố ý (không phải rung sự kiện) và bắt đầu
// báo cáo dồn dập mỗi ESCALATION_INTERVAL_MS (bỏ qua cooldown) cho tới khi BE tự disqualify.
const PROLONGED_EXIT_THRESHOLD_MS = 5000;
const ESCALATION_INTERVAL_MS = 1500;

/**
 * Phát hiện hành vi rời khỏi màn hình thi và báo cáo lên BE:
 * - visibilitychange (tab ẩn)   → TabSwitch
 * - blur (mất focus cửa sổ)     → WindowBlur
 * - fullscreenchange (thoát FS) → ExitFullscreen (+ escalate nếu ở ngoài quá lâu, xem trên)
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

  // Hẹn giờ "ở ngoài fullscreen quá lâu" (setTimeout) và interval báo cáo dồn dập sau khi hẹn giờ
  // đó kích hoạt — cả 2 đều phải huỷ ngay khi học sinh quay lại fullscreen hoặc đã bị terminate.
  const escalationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const escalationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminatedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    terminatedRef.current = false;

    const clearEscalation = () => {
      if (escalationTimeoutRef.current) {
        clearTimeout(escalationTimeoutRef.current);
        escalationTimeoutRef.current = null;
      }
      if (escalationIntervalRef.current) {
        clearInterval(escalationIntervalRef.current);
        escalationIntervalRef.current = null;
      }
    };

    // bypassCooldown=true dùng cho báo cáo dồn dập lúc escalate — hành vi lúc đó là cố ý ở lại
    // ngoài fullscreen, không phải rung/giật sự kiện, nên không cần chặn theo cooldown như bình thường.
    const report = (type: BrowserViolationType, bypassCooldown = false) => {
      const pid = participationIdRef.current;
      if (!pid) {
        // participationId chưa sẵn sàng (vd exam chưa join xong ở BE) — không có gì để gửi kèm nên
        // bỏ qua, nhưng log lại vì đây là nguyên nhân phổ biến khiến violation "im lặng" hoàn toàn.
        console.warn(`[useBrowserViolation] Skipped reporting ${type} — no participationId yet.`);
        return;
      }

      if (!bypassCooldown) {
        const now = Date.now();
        const last = lastReportedAtRef.current[type] ?? 0;
        if (now - last < COOLDOWN_MS) return;
        lastReportedAtRef.current[type] = now;
      }

      reportBrowserViolation({ participationId: pid, violationType: type })
        .then((res) => {
          onReportedRef.current?.(res.currentViolationCount, res.examTerminated);
          if (res.examTerminated) {
            // Đã bị disqualify — dừng escalate ngay, tránh gọi API thừa.
            terminatedRef.current = true;
            clearEscalation();
          }
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
      if (!document.fullscreenElement) {
        report('ExitFullscreen');
        if (terminatedRef.current) return;

        // Bắt đầu lại từ đầu mỗi lần thoát — tránh chồng nhiều timer nếu thoát/vào liên tục.
        clearEscalation();
        escalationTimeoutRef.current = setTimeout(() => {
          escalationTimeoutRef.current = null;
          if (terminatedRef.current || document.fullscreenElement) return;
          escalationIntervalRef.current = setInterval(() => {
            if (terminatedRef.current || document.fullscreenElement) {
              clearEscalation();
              return;
            }
            report('ExitFullscreen', true);
          }, ESCALATION_INTERVAL_MS);
        }, PROLONGED_EXIT_THRESHOLD_MS);
      } else {
        // Quay lại fullscreen kịp thời — huỷ hẹn giờ/escalate ngay, không báo cáo thêm.
        clearEscalation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearEscalation();
    };
  }, [enabled]);
}
