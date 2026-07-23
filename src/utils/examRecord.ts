// Parse BE's ExamRecord JSON string (xem Services/StudentExamRecordService.cs BuildSubmissionRecord)
// — không có field/endpoint typed riêng cho breakdown từng câu, nên FE phải tự parse chuỗi này.

export interface ParsedExamAnswer {
  questionId: string;
  questionType: string;
  optionId: string | null;
  selectedOption: string | null;
  answerText: string | null;
  awardedPoints: number;
  maxPoints: number;
  needsManualMarking: boolean;
}

export interface ParsedExamRecord {
  examSlotId: string;
  studentId: string;
  submittedAt: string;
  durationSeconds: number;
  finalScore: number;
  maxScore: number;
  requiresManualMarking: boolean;
  answers: ParsedExamAnswer[];
}

export function parseExamRecord(raw: string | null): ParsedExamRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.answers)) return null;
    return parsed as ParsedExamRecord;
  } catch {
    return null;
  }
}
