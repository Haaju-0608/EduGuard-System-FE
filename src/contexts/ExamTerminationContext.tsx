import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import type { HubConnection } from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { useHubConnection, useHubEvent, useHubGroup } from '../hooks/useHubConnection';
import { HubRoute } from '../services/realtimeClient';
import { fetchExamParticipationStatus } from '../services/schoolAdminApi';
import type {
  BrowserViolationDetectedEventPayload,
  DisqualifiedEventPayload,
  ExamTerminatedEventPayload,
  ViolationDetectedEventPayload,
} from '../types/termination';

interface ExamTerminationContextType {
  isExamTerminated: boolean;
  reason: string | null;
  recordedAt: string | null;
  browserViolationCount: number;
  /** Số vi phạm AI (gaze/head turn/absence/...) đã ghi nhận — lấy từ server (SignalR
   *  ViolationDetected.currentAiViolationCount hoặc GET /status), KHÔNG tự đếm cục bộ ở
   *  ViolationEngine, để màn học sinh và dashboard giáo viên luôn khớp số. */
  aiViolationCount: number;
  /** 'disqualified' = bị lecturer disqualify thủ công (có thể restore); 'browser-violation' = auto-terminate do 3-strike */
  terminationType: 'browser-violation' | 'disqualified' | null;
  /** Gọi khi trang thi biết được participationId (và gọi lại với null khi rời trang). Cần kèm
   *  examSlotId để tự JOIN group SignalR đúng của học sinh (xem ghi chú ở registerParticipation). */
  registerParticipation: (participationId: string | null, examSlotId?: string | null) => void;
  /** Check lại status thủ công — dùng cho recovery (F5, mất mạng rồi có lại, hoặc sau khi lecturer restore) */
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
  const [examSlotId, setExamSlotId] = useState<string | null>(null);
  const [isExamTerminated, setIsExamTerminated] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [browserViolationCount, setBrowserViolationCount] = useState(0);
  const [aiViolationCount, setAiViolationCount] = useState(0);
  const [terminationType, setTerminationType] = useState<'browser-violation' | 'disqualified' | null>(null);

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
      setAiViolationCount(status.aiViolationCount);
      if (status.isTerminated) {
        applyTerminated({ reason: status.terminationReason, recordedAt: null });
      } else {
        // Participation đã được restore (Disqualified → Joined) — clear terminated state để sinh
        // viên có thể tiếp tục làm bài mà không cần F5.
        setIsExamTerminated(false);
        setReason(null);
        setRecordedAt(null);
        setTerminationType(null);
      }
    } catch {
      // Không chặn thi nếu check status lỗi tạm thời — lần check kế / SignalR sẽ bù sau.
    }
  }, [applyTerminated]);

  const registerParticipation = useCallback((id: string | null, slotId?: string | null) => {
    setParticipationId((prev) => (prev === id ? prev : id));
    setExamSlotId((prev) => {
      const next = id ? (slotId ?? null) : null;
      return prev === next ? prev : next;
    });
    if (!id) {
      setIsExamTerminated(false);
      setReason(null);
      setRecordedAt(null);
      setBrowserViolationCount(0);
      setAiViolationCount(0);
      setTerminationType(null);
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

  // BẮT BUỘC gọi JoinExam(examSlotId) để BE add connection vào đúng group
  // HubGroups.ExamStudent(examSlotId, studentId) — thiếu bước này thì MỌI event bắn qua
  // PushExamStudentAsync (ViolationDetected, ExamTerminated...) không bao giờ tới được trình
  // duyệt học sinh, dù BE đã bắn đúng và Notification (kênh riêng, qua PushUserAsync/NotificationHub)
  // vẫn báo bình thường — đây là lý do "đã có thông báo nhưng count trên màn thi vẫn là 0". Browser
  // violation không bị ảnh hưởng vì count của nó lấy trực tiếp từ response của chính POST request
  // (notifyViolationReported), không phụ thuộc SignalR.
  useHubGroup(HubRoute.Exams, 'JoinExam', examSlotId ? [examSlotId] : null);

  useHubEvent<ExamTerminatedEventPayload>(examHub, 'ExamTerminated', (payload) => {
    if (!payload || payload.participationId !== participationIdRef.current) return;
    setTerminationType('browser-violation');
    applyTerminated({
      reason: payload.reason ?? null,
      recordedAt: payload.terminatedAt ?? new Date().toISOString(),
    });
  });

  // Lecturer đình chỉ (disqualify) thủ công — event riêng 'Disqualified' (khác 'ExamTerminated'
  // vốn chỉ dành cho auto-terminate do 3-strike browser violation). Type 'disqualified' cho phép
  // StudentExamTakingPage KHÔNG auto-submit ngay, để lecturer có thời gian restore nếu cần.
  useHubEvent<DisqualifiedEventPayload>(examHub, 'Disqualified', (payload) => {
    if (!payload || payload.participationId !== participationIdRef.current) return;
    setTerminationType('disqualified');
    applyTerminated({
      reason: payload.reason ?? null,
      recordedAt: payload.disqualifiedAt ?? new Date().toISOString(),
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

  // Vi phạm AI (gaze/head turn/absence/...) — bắn tới CẢ student lẫn lecturer group với cùng 1
  // currentAiViolationCount tính từ server (xem ViolationlogServices.CreateAsync). Đây là nguồn
  // đếm chuẩn duy nhất cho màn hình thi của học sinh — không tự cộng dồn theo event nội bộ của
  // ViolationEngine (vốn đếm TRƯỚC khi biết BE có tạo record thật hay bị cooldown/dedupe).
  useHubEvent<ViolationDetectedEventPayload>(examHub, 'ViolationDetected', (payload) => {
    if (!payload || payload.participationId !== participationIdRef.current) return;
    setAiViolationCount(payload.currentAiViolationCount);
  });


  // 4) Recovery — mạng rớt rồi SignalR tự reconnect lại: check status ngay thay vì đợi event mới,
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
        isExamTerminated, reason, recordedAt, browserViolationCount, aiViolationCount, terminationType,
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
