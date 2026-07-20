import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import type { HubConnection } from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { useHubConnection, useHubEvent } from '../hooks/useHubConnection';
import { HubRoute } from '../services/realtimeClient';
import { fetchExamParticipationStatus } from '../services/schoolAdminApi';
import type { BrowserViolationDetectedEventPayload, ExamTerminatedEventPayload } from '../types/termination';

interface ExamTerminationContextType {
  isExamTerminated: boolean;
  reason: string | null;
  recordedAt: string | null;
  browserViolationCount: number;
  /** Gọi khi trang thi biết được participationId (và gọi lại với null khi rời trang) */
  registerParticipation: (participationId: string | null) => void;
  /** Check lại status thủ công — dùng cho recovery (F5, mất mạng rồi có lại) */
  refreshStatus: () => Promise<void>;
  /**
   * Gọi ngay sau mỗi lần POST /api/browser-violations thành công — response đã có sẵn
   * currentViolationCount/examTerminated NGAY LẬP TỨC, không cần đợi SignalR mới biết vừa bị
   * terminate hay chưa (nhanh và chắc chắn hơn cả event, vì đây chính là response của request đó).
   */
  notifyViolationReported: (currentViolationCount: number, examTerminated: boolean) => void;
}

const ExamTerminationContext = createContext<ExamTerminationContextType | undefined>(undefined);

export function ExamTerminationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [participationId, setParticipationId] = useState<string | null>(null);
  const [isExamTerminated, setIsExamTerminated] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [browserViolationCount, setBrowserViolationCount] = useState(0);

  const participationIdRef = useRef<string | null>(null);
  participationIdRef.current = participationId;

  const applyTerminated = useCallback((payload: {
    reason: string | null; recordedAt: string | null; browserViolationCount?: number;
  }) => {
    setIsExamTerminated(true);
    setReason(payload.reason);
    setRecordedAt(payload.recordedAt);
    if (payload.browserViolationCount !== undefined) {
      setBrowserViolationCount(payload.browserViolationCount);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const pid = participationIdRef.current;
    if (!pid) return;
    try {
      const status = await fetchExamParticipationStatus(pid);
      // participationId có thể đã đổi (sang bài thi khác) trong lúc request đang chạy — bỏ qua kết quả cũ.
      if (participationIdRef.current !== pid) return;
      setBrowserViolationCount(status.browserViolationCount);
      if (status.isTerminated) {
        applyTerminated({ reason: status.terminationReason, recordedAt: null });
      }
    } catch {
      // Không chặn thi nếu check status lỗi tạm thời — lần check kế / SignalR sẽ bù sau.
    }
  }, [applyTerminated]);

  const registerParticipation = useCallback((id: string | null) => {
    setParticipationId((prev) => (prev === id ? prev : id));
    if (!id) {
      setIsExamTerminated(false);
      setReason(null);
      setRecordedAt(null);
      setBrowserViolationCount(0);
    }
  }, []);

  // POST /api/browser-violations trả examTerminated ngay trong response — dùng luôn thay vì đợi
  // SignalR. terminationReason chính xác lấy qua refreshStatus() (BE đã set DisqualifiedReason
  // xong trước khi trả response POST, nên GET /status ngay sau đó đã phản ánh đúng).
  const notifyViolationReported = useCallback((currentViolationCount: number, examTerminated: boolean) => {
    setBrowserViolationCount(currentViolationCount);
    if (examTerminated) {
      void refreshStatus();
    }
  }, [refreshStatus]);

  // 1) Initial status check ngay khi có participationId (mount lần đầu, sau F5, vào lại phòng thi)
  //    — không đợi SignalR mới biết bài thi đã bị terminate hay chưa.
  useEffect(() => {
    if (!participationId) return;
    void refreshStatus();
  }, [participationId, refreshStatus]);

  // 2) SignalR — dùng chung hub connection sẵn có (HubRoute.Exams), chỉ connect khi có
  //    participation đang active để tránh giữ socket vô ích ngoài lúc thi.
  const examHub = useHubConnection(HubRoute.Exams, isAuthenticated && !!participationId);

  useHubEvent<ExamTerminatedEventPayload>(examHub, 'ExamTerminated', (payload) => {
    if (!payload || payload.participationId !== participationIdRef.current) return;
    applyTerminated({
      reason: payload.reason ?? null,
      recordedAt: payload.terminatedAt ?? new Date().toISOString(),
    });
  });

  // Bắn ở MỌI lần report (kể cả chưa terminate) — dùng để cập nhật browserViolationCount realtime,
  // và làm lớp dự phòng thứ 2 (ngoài notifyViolationReported) cho việc phát hiện terminate.
  useHubEvent<BrowserViolationDetectedEventPayload>(examHub, 'BrowserViolationDetected', (payload) => {
    if (!payload || payload.participationId !== participationIdRef.current) return;
    setBrowserViolationCount(payload.currentViolationCount);
    if (payload.examTerminated) {
      void refreshStatus();
    }
  });

  // 3) Recovery — mạng rớt rồi SignalR tự reconnect lại: check status ngay thay vì đợi event mới,
  //    vì trong lúc mất kết nối có thể đã bị terminate mà chưa nhận được event.
  const reconnectHandlerRegisteredRef = useRef(new WeakSet<HubConnection>());
  useEffect(() => {
    if (!examHub) return;
    if (reconnectHandlerRegisteredRef.current.has(examHub)) return;
    reconnectHandlerRegisteredRef.current.add(examHub);
    examHub.onreconnected(() => { void refreshStatus(); });
  }, [examHub, refreshStatus]);

  // 4) Recovery — trình duyệt mất mạng (offline) rồi có mạng lại: check ngay khi online,
  //    không phụ thuộc SignalR (SignalR có thể mất vài giây mới reconnect xong).
  useEffect(() => {
    const onOnline = () => { void refreshStatus(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refreshStatus]);

  return (
    <ExamTerminationContext.Provider
      value={{
        isExamTerminated, reason, recordedAt, browserViolationCount,
        registerParticipation, refreshStatus, notifyViolationReported,
      }}
    >
      {children}
    </ExamTerminationContext.Provider>
  );
}

export function useExamTermination(): ExamTerminationContextType {
  const ctx = useContext(ExamTerminationContext);
  if (!ctx) throw new Error('useExamTermination must be used within ExamTerminationProvider');
  return ctx;
}
