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
  /** BE: string? — có thể null nếu tạo lớp mà bỏ trống Course Code */
  courseCode: string | null;
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
  lecturer?: { id: string; fullName: string; email: string; studentCode: string | null } | null;
  /** BE mới thêm — giám thị coi thi riêng cho buổi thi này, khác với lecturer (giảng viên phụ
   *  trách lớp). null nếu School Admin không chỉ định riêng, mặc định giảng viên lớp sẽ coi thi. */
  proctor?: { id: string; fullName: string; email: string; studentCode: string | null } | null;
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
  examSlotId: string | null;
  createdBy: string;
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
  /** BE trả "checkinAt" (từ property C# CheckinAt qua camelCase), không phải "checkInTime" */
  checkinAt: string | null;
  student: ApiUser | null;
  /** Chỉ có khi gọi kèm expand=session */
  session: { id: string; classId: string; examSlotId: string | null; status: string; startTime: string } | null;
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

/** Đơn "Contact Us / Request Demo" từ landing page — GET /api/contact-requests. Status là chuỗi
 *  chữ hoa tự do từ BE, không phải enum thật: 'PENDING' | 'CONTACTED' | 'APPROVED' | 'REJECTED'. */
export interface ApiContactRequest {
  id: string;
  schoolName: string;
  contactPersonName: string;
  email: string;
  phoneNumber: string;
  message: string | null;
  status: string;
  createdAt: string;
}

/** Pricing config từ GET /api/pricing-configs */
export interface ApiPricingConfig {
  id: string;
  serviceType: string;
  unitPrice: number;
  effectiveDate: string;
  isActive: boolean;
  createdAt: string;
}

export type ParticipationStatus = 'Joined' | 'Submitted' | 'Disqualified' | 'Absent' | 'Left';

/** Exam participation từ GET /api/exam-participations */
export interface ApiExamParticipation {
  id: string;
  examSlotId: string;
  examName: string | null;
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
  passageId: string | null;
  passageText: string | null;
  questionType: string;
  questionContent: string;
  audioUrl: string | null;
  imageUrl: string | null;
  points: number;
  displayOrder: number;
  createdAt: string;
  options: ApiQuestionOption[];
}

/** Đoạn văn Reading từ GET/POST/PUT /api/reading-passages */
export interface ApiReadingPassage {
  id: string;
  examSlotId: string;
  passageText: string;
  createdAt: string;
  updatedAt: string;
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

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface SystemDashboard {
  range: { from: string | null; to: string | null };
  institutions: {
    total: number;
    byStatus: { status: string; count: number }[];
  };
  users: {
    total: number;
    byRole: { role: string; count: number }[];
  };
  academic: {
    classes: number;
    examSlots: number;
    attendanceSessions: number;
    violations: number;
  };
  wallet: {
    totalBalance: number;
    topUpAmount: number;
    serviceFeeAmount: number;
  };
}

export interface InstitutionDashboard {
  institutionId: string;
  range: { from: string | null; to: string | null };
  classes: number;
  users: { students: number; lecturers: number; admins: number };
  attendance: { sessions: number; completed: number; recognized: number };
  exams: { slots: number; submitted: number; disqualified: number };
  violations: number;
  wallet: {
    id: string;
    balance: number;
    currency: string;
    lowBalanceThreshold: number;
  } | null;
}

export interface LecturerDashboard {
  lecturerId: string;
  fullName: string;
  range: { from: string | null; to: string | null };
  classes: number;
  students: number;
  attendance: { sessions: number; inProgress: number; recognized: number };
  exams: { slots: number; inProgress: number; submitted: number };
  violations: number;
}
