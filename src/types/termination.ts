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

/** Payload event "BrowserViolationDetected" bắn qua SignalR hub Exams — bắn ở MỌI lần report, kể cả chưa terminate */
export interface BrowserViolationDetectedEventPayload {
  participationId: string;
  violationType: BrowserViolationType;
  currentViolationCount: number;
  examTerminated: boolean;
  recordedAt: string | null;
}
