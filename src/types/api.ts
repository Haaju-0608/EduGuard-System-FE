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
  lecturer: unknown;
  enrollments: unknown[] | null;
}

/** User từ GET /api/users */
export interface ApiUser {
  id: string;
  institutionId: string | null;
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
}

/** Biometric request từ GET /api/biometric-requests */
export interface ApiBiometricRequest {
  id: string;
  studentId: string;
  approvedBy: string | null;
  reason: string | null;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
  student: ApiUser | null;
  approver: ApiUser | null;
}
