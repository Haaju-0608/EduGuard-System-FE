/**
 * Types cho tính năng phát hiện vi phạm trình duyệt (đổi tab, mất focus, thoát fullscreen)
 * và chấm dứt bài thi (exam termination) — dùng chung giữa hook phát hiện, context, và API layer.
 *
 * Khớp với contract thật của BE (Services/BrowserViolationService.cs,
 * Controllers/ExamparticipationController.cs GET {id}/status, Hubs/HubEvents.cs).
 */

export type BrowserViolationType = 'TabSwitch' | 'WindowBlur' | 'ExitFullscreen';

/** Request body của POST /api/browser-violations — BE chỉ nhận đúng 2 field này */
export interface BrowserViolationRequest {
  participationId: string;
  violationType: BrowserViolationType;
}

/** `data` trong response POST /api/browser-violations */
export interface BrowserViolationResponse {
  success: boolean;
  currentViolationCount: number;
  examTerminated: boolean;
}

/** `data` trong response GET /api/exam-participations/{id}/status */
export interface ExamParticipationStatusResponse {
  participationId: string;
  /** "Active" (Joined) | "Terminated" (Disqualified) | tên enum ParticipationStatus khác */
  status: string;
  isTerminated: boolean;
  terminationReason: string | null;
  browserViolationCount: number;
  /** Số vi phạm AI (không tính browser violation) đã ghi nhận — nguồn đếm chuẩn duy nhất, khớp
   *  đúng số record thật trong DB (đã qua cooldown/max-count/consecutive-type của BE). */
  aiViolationCount: number;
}

/** Payload event "ExamTerminated" bắn qua SignalR hub Exams */
export interface ExamTerminatedEventPayload {
  participationId: string;
  examSlotId: string;
  reason: string | null;
  terminatedAt: string | null;
}

/** Payload event "Disqualified" bắn qua SignalR hub Exams — khi Lecturer đình chỉ thủ công từ
 *  trang review violation (khác "ExamTerminated", vốn chỉ bắn khi tự động terminate do 3-strike
 *  browser violation — xem Services/ExamWorkflowService.cs DisqualifyAsync) */
export interface DisqualifiedEventPayload {
  participationId: string;
  examSlotId: string;
  examName: string | null;
  studentId: string;
  fullName: string | null;
  reason: string | null;
  disqualifiedAt: string | null;
}

/** Payload event "BrowserViolationDetected" bắn qua SignalR hub Exams — bắn ở MỌI lần report, kể cả chưa terminate */
export interface BrowserViolationDetectedEventPayload {
  participationId: string;
  violationType: BrowserViolationType;
  currentViolationCount: number;
  examTerminated: boolean;
  recordedAt: string | null;
}

// ─── Live Lecturer Monitoring (Hubs/ExamHub.cs JoinLecturerDashboard + GET .../realtime-state) ──

/** 1 sinh viên trong `GET /api/exam-slots/{id}/realtime-state` (Services/ExamWorkflowService.cs GetRealtimeStateAsync) */
export interface ExamRealtimeStudent {
  participationId: string;
  studentId: string;
  fullName: string;
  status: string;
  actualStart: string | null;
  actualEnd: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
  violationCount: number;
}

/** Response `GET /api/exam-slots/{id}/realtime-state` — snapshot ban đầu trước khi nghe SignalR tiếp */
export interface ExamRealtimeStateResponse {
  examSlotId: string;
  examName: string | null;
  startTime: string;
  endTime: string;
  totalStudents: number;
  onlineCount: number;
  offlineCount: number;
  submittedCount: number;
  disqualifiedCount: number;
  violationCount: number;
  students: ExamRealtimeStudent[];
}

export interface StudentOnlineEventPayload {
  participationId: string; examSlotId: string; studentId: string; fullName: string; onlineAt: string;
}
export interface StudentOfflineEventPayload {
  participationId: string; examSlotId: string; studentId: string; fullName: string; disconnectedAt: string;
}
export interface StudentJoinedExamEventPayload {
  participationId: string; examSlotId: string; examName: string | null; studentId: string; fullName: string;
  joinedAt: string; submittedCount: number; onlineCount: number;
}
export interface ExamSubmittedEventPayload {
  participationId: string; examSlotId: string; examName: string | null; studentId: string; fullName: string;
  submittedAt: string; submittedCount: number; totalStudents: number;
}

/** Payload event "ViolationDetected" bắn qua SignalR hub Exams — vi phạm AI thật (khác
 *  "BrowserViolationDetected" ở trên, vốn chỉ dành cho đổi tab/mất focus/thoát fullscreen).
 *  Xem Services/ViolationlogServices.cs. Bắn tới CẢ student (để cập nhật số đếm trên màn thi)
 *  VÀ lecturer group cùng lúc, với cùng 1 currentAiViolationCount tính từ server — đây là nguồn
 *  đếm chuẩn duy nhất, không tự cộng dồn ở FE (giống pattern browserViolationCount). */
export interface ViolationDetectedEventPayload {
  violationId: string;
  participationId: string;
  examSlotId: string;
  examName: string | null;
  studentId: string;
  fullName: string;
  type: string;
  severity: string;
  confidence: number | null;
  evidencePath: string | null;
  recordedAt: string;
  currentAiViolationCount: number;
}

/** Payload event "ViolationThresholdReached" bắn qua SignalR hub Exams tới Lecturer group — khi
 *  số vi phạm (AI hoặc browser) của 1 student đạt đúng ngưỡng thông báo (AiNotifyThreshold /
 *  BrowserNotifyThreshold trong ProctoringSettings). KHÔNG tự disqualify — chỉ nhắc Lecturer tự
 *  quyết định. `kind` phân biệt 2 nguồn; field đếm riêng theo từng kind (currentAiViolationCount
 *  vs currentBrowserViolationCount), còn participationId/examSlotId/studentId/fullName/threshold
 *  giống nhau ở cả 2 — đã chuẩn hoá thống nhất field `participationId` cho cả 2 kind (trước đây
 *  kind "ai" dùng field "id" do lỗi C# anonymous type, đã fix ở ViolationlogServices.cs). */
export type ViolationThresholdReachedEventPayload =
  | {
      kind: 'ai';
      participationId: string;
      examSlotId: string;
      studentId: string;
      fullName: string;
      currentAiViolationCount: number;
      threshold: number;
      maxAiViolationCount: number;
    }
  | {
      kind: 'browser';
      participationId: string;
      examSlotId: string;
      studentId: string;
      fullName: string;
      currentBrowserViolationCount: number;
      threshold: number;
    };

/** 1 dòng trong `violationTypeThresholds` của GET /api/proctoring-settings/effective — ngưỡng
 *  thời gian (giây) để tính là 1 vi phạm cho từng loại. Tên loại theo enum BE (khác tên nội bộ
 *  FE trong ai/types/proctoring.ts — xem AI_VIOLATION_TYPE_TO_FE_MAP khi áp dụng). */
export interface ProctoringViolationTypeThreshold {
  violationType: 'GazeDiversion' | 'MultipleFaces' | 'Absence' | 'HeadTurn' | 'FaceObstructed' | 'Impersonation';
  detectionThresholdSeconds: number;
}

/** `data` trong response GET /api/proctoring-settings/effective — cấu hình AI Proctoring đang áp
 *  dụng cho 1 institution (hoặc mặc định toàn hệ thống nếu institutionId null). Field
 *  maxAiViolationCount/cooldownSeconds/allowConsecutiveSameType/aiNotifyThreshold/
 *  browserNotifyThreshold đã được BE tự enforce phía server — FE KHÔNG cần tự áp dụng lại, chỉ
 *  cần đọc violationTypeThresholds để cấu hình ViolationEngine (thời gian giữ trạng thái trước
 *  khi báo 1 vi phạm — xem ai/engines/ViolationEngine.ts). */
export interface EffectiveProctoringSettings {
  id: string;
  institutionId: string | null;
  maxAiViolationCount: number;
  cooldownSeconds: number;
  allowConsecutiveSameType: boolean;
  aiNotifyThreshold: number;
  browserNotifyThreshold: number;
  isActive: boolean;
  violationTypeThresholds: ProctoringViolationTypeThreshold[];
}
