/** Phân trang chuẩn từ backend EduGuard */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Response GET có pagination */
export interface PaginatedApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination: PaginationMeta;
  errors?: unknown;
}

/** Lớp học từ GET /api/classes */
export interface ApiClass {
  id: string;
  institutionId: string | null;
  lecturerId: string;
  courseName: string;
  courseCode: string;
  semester: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  institution: unknown;
  lecturer: { id: string; fullName: string; email: string } | null;
  enrollments: unknown[] | null;
}

/** User từ GET /api/users */
export interface ApiUser {
  id: string;
  institutionId: string | null;
  institution?: { id: string; name: string } | null;
  studentCode: string | null;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export interface PagedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
}

/** Enrollment từ GET /api/enrollments */
export interface ApiEnrollment {
  classId: string;
  studentId: string;
  status: string;
  enrolledAt: string;
  class: ApiClass | null;
  student: ApiUser | null;
}

/** Exam slot từ GET /api/exam-slots */
export interface ApiExamSlot {
  id: string;
  classId: string;
  examName: string;
  startTime: string;
  endTime: string;
  expectedDurationMinutes: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  proctorId?: string;
  lecturer?: { id: string; fullName: string; email: string; studentCode: string | null } | null;
}

/** Biometric request từ GET /api/biometric-requests */
/** 1 request = 1 student submission chứa cả 3 ảnh (front/left/right), 1 status chung cho cả bộ 3 —
 *  không còn là 3 dòng riêng biệt như trước (xem Models/BiometricRequest.cs). frontImageUrl/
 *  leftImageUrl/rightImageUrl là URL Supabase đầy đủ, dùng thẳng được trong <img src>, không cần
 *  ký lại qua /api/storage/signed-url. faceImageUrl là ảnh đại diện, chỉ có sau khi approved. */
export interface ApiBiometricRequest {
  id: string;
  studentId: string;
  approvedBy: string | null;
  reason: string | null;
  status: string;
  frontImageUrl: string | null;
  leftImageUrl: string | null;
  rightImageUrl: string | null;
  faceImageUrl: string | null;
  reviewedAt: string | null;
  createdAt: string;
  student: ApiUser | null;
  approver: ApiUser | null;
}

/** Wallet từ GET /api/wallets/institution/{institutionId} */
export interface ApiWallet {
  id: string;
  institutionId: string;
  balance: number;
  totalDeducted: number;
  createdAt: string;
  updatedAt: string;
}

/** Transaction từ GET /api/transactions/wallet/{walletId} */
export interface ApiTransaction {
  id: string;
  walletId: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: string;
  status: string;
}

/** Attendance session từ GET /api/attendance-sessions */
export interface ApiAttendanceSession {
  id: string;
  classId: string;
  startTime: string;
  endTime: string | null;
  videoPath: string | null;
  status: string;
  createdAt: string;
  class: ApiClass | null;
}

/** Attendance record từ GET /api/attendance-records */
export interface ApiAttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: string;
  checkInTime: string | null;
  student: ApiUser | null;
}

/** Violation log từ GET /api/violation-logs */
export interface ApiViolationLog {
  id: string;
  participationId: string;
  severity: string;
  violationType: string;
  evidencePath: string | null;
  aiConfidence: number | null;
  reviewedBy: string | null;
  recordedAt: string;
  createdAt: string;
}

/** Notification từ GET /api/notifications/user/{userId} */
export interface ApiNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: string | null;
}

/** Institution từ GET /api/institutions */
export interface ApiInstitution {
  id: string;
  name: string | null;
  subDomain: string | null;
  contactEmail: string | null;
  subscriptionExpiresAt: string | null;
  billingModel: string;
  status: string;
  createdAt: string;
}

/** Pricing config từ GET /api/pricing-configs */
export interface ApiPricingConfig {
  id: string;
  serviceType: string;
  unitPrice: number;
  effectiveDate: string;
  createdAt: string;
}

export type ParticipationStatus = 'Joined' | 'Submitted' | 'Disqualified' | 'Absent' | 'Left';

/** Exam participation từ GET /api/exam-participations */
export interface ApiExamParticipation {
  id: string;
  examSlotId: string;
  studentId: string;
  status: ParticipationStatus;
  actualStart: string | null;
  actualEnd: string | null;
  disqualifiedReason: string | null;
  joinedAt: string | null;
  student: ApiUser | null;
}

/** Option của 1 câu hỏi trắc nghiệm — GET /api/exam-questions */
export interface ApiQuestionOption {
  id: string;
  questionId: string;
  optionLabel: string;
  optionContent: string;
  /** null khi role Student gọi — BE không lộ đáp án đúng cho student */
  isCorrect: boolean | null;
}

/** Câu hỏi thi từ GET /api/exam-questions */
export interface ApiExamQuestion {
  id: string;
  examSlotId: string;
  examName: string | null;
  questionType: string;
  questionContent: string;
  audioUrl: string | null;
  imageUrl: string | null;
  points: number;
  displayOrder: number;
  createdAt: string;
  options: ApiQuestionOption[];
}

/** Kết quả bài thi từ POST /api/student-exam-records/submit */
export interface ApiStudentExamRecord {
  id: string;
  examSlotId: string;
  examName: string | null;
  studentId: string;
  studentName: string | null;
  createdAt: string;
  endedAt: string | null;
  examRecord: string | null;
  finalScore: number | null;
  submittedAt: string | null;
  durationSeconds: number | null;
  status: string;
}

/** Deduct attendance request */
export interface DeductAttendancePayload {
  walletId: string;
  attendanceSessionId: string;
  studentCount: number;
}

/** Deduct proctoring request */
export interface DeductProctoringPayload {
  walletId: string;
  examParticipationId: string;
  hours: number;
}

/** Update own profile */
export interface UpdateUserMePayload {
  fullName?: string | null;
  phone?: string | null;
}
