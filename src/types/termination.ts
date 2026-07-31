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
 *  Xem Services/ViolationlogServices.cs. */
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
}
