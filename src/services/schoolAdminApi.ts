/**
 * API SchoolAdmin — classes, users, enrollments, exam-slots.
 * Enrollment là optional (SchoolAdmin có thể bị 403 — không làm fail các API khác).
 */
import { getInitialsFromName } from './authApi';
import { ApiError, apiDelete, apiGet, apiGetPaginated, apiPost, apiPut, buildQueryParams } from './apiClient';
import type {
  ApiBiometricRequest,
  ApiAttendanceSession,
  ApiClass,
  ApiEnrollment,
  ApiExamParticipation,
  ApiExamSlot,
  ApiTransaction,
  ApiUser,
  ApiWallet,
  DeductAttendancePayload,
  DeductProctoringPayload,
  ListQueryParams,
  PagedResult,
  ParticipationStatus,
  PaginationMeta,
  UpdateUserMePayload,
} from '../types/api';
import type {
  ClassStatus,
  BiometricRequest,
  BiometricStatus,
  ExamSlot,
  ExamSlotStatus,
  LecturerClass,
  LecturerStudent,
  StudentStatus,
} from '../types/lecturer';
import { getFacultyByCourseCode } from '../utils/facultyTheme';

const DEFAULT_PAGE_SIZE = 50;

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
};

function deriveClassStatus(startDate: string, endDate: string): ClassStatus {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) return 'upcoming';
  if (now > end) return 'completed';
  return 'active';
}

function mapApiUserStatus(status: string): StudentStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'active') return 'active';
  if (normalized === 'blocked' || normalized === 'inactive') return 'inactive';
  return 'pending';
}

function deriveExamSlotStatus(slot: ApiExamSlot): ExamSlotStatus {
  const apiStatus = slot.status.trim().toLowerCase();
  if (apiStatus === 'cancelled' || apiStatus === 'canceled') return 'cancelled';

  const now = Date.now();
  const start = new Date(slot.startTime).getTime();
  const end = new Date(slot.endTime).getTime();
  if (now >= start && now <= end) return 'ongoing';
  if (now > end) return 'completed';
  return 'scheduled';
}

export function mapApiClassToLecturerClass(item: ApiClass): LecturerClass {
  const enrollments = Array.isArray(item.enrollments) ? item.enrollments : [];
  return {
    id: item.id,
    code: item.courseCode,
    name: item.courseName,
    facultyId: getFacultyByCourseCode(item.courseCode).id,
    semester: `${item.semester} · ${item.academicYear}`,
    schedule: `${item.startDate} → ${item.endDate}`,
    room: '—',
    studentCount: enrollments.length,
    status: deriveClassStatus(item.startDate, item.endDate),
    attendanceRate: 0,
  };
}

export function mapApiUserToLecturerStudent(item: ApiUser): LecturerStudent {
  const name = item.fullName?.trim() || item.email;
  return {
    id: item.id,
    studentId: item.studentCode && item.studentCode !== 'none' ? item.studentCode : '—',
    name,
    email: item.email,
    phone: item.phone?.trim() || '—',
    classId: '',
    classCode: '—',
    className: 'Not assigned',
    facultyId: getFacultyByCourseCode(item.studentCode ?? '').id,
    status: mapApiUserStatus(item.status),
    attendanceRate: 0,
    avatar: null,
    initials: getInitialsFromName(name),
  };
}

function mapApiExamSlot(slot: ApiExamSlot, classMap: Map<string, LecturerClass>): ExamSlot {
  const cls = classMap.get(slot.classId);
  return {
    id: slot.id,
    classId: slot.classId,
    classCode: cls?.code ?? slot.classId.slice(0, 8),
    className: cls?.name ?? 'Unknown class',
    examName: slot.examName,
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMinutes: slot.expectedDurationMinutes,
    status: deriveExamSlotStatus(slot),
  };
}

function applyEnrollmentCounts(
  classes: LecturerClass[],
  enrollments: ApiEnrollment[],
): LecturerClass[] {
  if (enrollments.length === 0) return classes;

  const counts = enrollments.reduce<Record<string, number>>((acc, item) => {
    if (item.status.trim().toLowerCase() === 'active') {
      acc[item.classId] = (acc[item.classId] ?? 0) + 1;
    }
    return acc;
  }, {});

  return classes.map((cls) => ({
    ...cls,
    studentCount: counts[cls.id] ?? cls.studentCount,
  }));
}

function applyEnrollmentsToStudents(
  students: LecturerStudent[],
  enrollments: ApiEnrollment[],
  classMap: Map<string, LecturerClass>,
): LecturerStudent[] {
  if (enrollments.length === 0) return students;

  const activeByStudent = new Map<string, ApiEnrollment[]>();

  enrollments.forEach((item) => {
    if (item.status.trim().toLowerCase() !== 'active') return;
    const list = activeByStudent.get(item.studentId) ?? [];
    list.push(item);
    activeByStudent.set(item.studentId, list);
  });

  return students.map((student) => {
    const enrollment = activeByStudent.get(student.id)?.[0];
    if (!enrollment) return student;

    const cls = classMap.get(enrollment.classId);
    if (!cls) return student;

    return {
      ...student,
      classId: cls.id,
      classCode: cls.code,
      className: cls.name,
      facultyId: cls.facultyId,
    };
  });
}

/** GET /api/classes — raw, không gọi thêm API khác */
async function fetchApiClassesRaw(params: ListQueryParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  return apiGetPaginated<ApiClass[]>(
    `/api/classes${buildQueryParams({ page, pageSize })}`,
  );
}

/** GET /api/users — raw */
async function fetchApiUsersRaw(params: ListQueryParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  return apiGetPaginated<ApiUser[]>(
    `/api/users${buildQueryParams({ page, pageSize })}`,
  );
}

/** GET /api/enrollments — trả rỗng nếu 403 (SchoolAdmin không có quyền) */
async function tryFetchEnrollments(
  params: ListQueryParams = {},
): Promise<PagedResult<ApiEnrollment>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  try {
    const { data, pagination } = await apiGetPaginated<ApiEnrollment[]>(
      `/api/enrollments${buildQueryParams({ page, pageSize })}`,
    );
    return { items: data, pagination };
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      return { items: [], pagination: EMPTY_PAGINATION };
    }
    throw e;
  }
}

/** GET /api/classes — kèm số SV từ enrollment nếu có quyền */
export async function fetchSchoolAdminClasses(
  params: ListQueryParams = {},
): Promise<PagedResult<LecturerClass>> {
  const [classRes, enrollmentRes] = await Promise.all([
    fetchApiClassesRaw(params),
    tryFetchEnrollments({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  return {
    items: applyEnrollmentCounts(
      classRes.data.map(mapApiClassToLecturerClass),
      enrollmentRes.items,
    ),
    pagination: classRes.pagination,
  };
}

/** GET /api/users (Student) — kèm lớp từ enrollment nếu có quyền */
export async function fetchSchoolAdminStudents(
  params: ListQueryParams = {},
): Promise<PagedResult<LecturerStudent>> {
  const [userRes, classRes, enrollmentRes] = await Promise.all([
    fetchApiUsersRaw(params),
    fetchApiClassesRaw({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    tryFetchEnrollments({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  const classItems = classRes.data.map(mapApiClassToLecturerClass);
  const classMap = new Map(classItems.map((cls) => [cls.id, cls]));

  const students = applyEnrollmentsToStudents(
    userRes.data
      .filter((user) => user.role.trim().toLowerCase() === 'student')
      .map(mapApiUserToLecturerStudent),
    enrollmentRes.items,
    classMap,
  );

  return {
    items: students,
    pagination: {
      ...userRes.pagination,
      totalItems: students.length,
    },
  };
}

/** GET /api/exam-slots */
export async function fetchExamSlots(
  params: ListQueryParams = {},
): Promise<PagedResult<ExamSlot>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const [slotRes, classRes] = await Promise.all([
    apiGetPaginated<ApiExamSlot[]>(
      `/api/exam-slots${buildQueryParams({ page, pageSize })}`,
    ),
    fetchApiClassesRaw({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  const classMap = new Map(
    classRes.data.map((item) => {
      const cls = mapApiClassToLecturerClass(item);
      return [cls.id, cls] as const;
    }),
  );

  return {
    items: slotRes.data.map((slot) => mapApiExamSlot(slot, classMap)),
    pagination: slotRes.pagination,
  };
}

/** Tổng hợp dashboard */
export async function fetchSchoolAdminOverviewStats() {
  const [classRes, students, exams] = await Promise.all([
    fetchSchoolAdminClasses({ page: 1, pageSize: 50 }),
    fetchSchoolAdminStudents({ page: 1, pageSize: 50 }),
    fetchExamSlots({ page: 1, pageSize: 50 }),
  ]);

  const upcomingExams = exams.items.filter(
    (e) => e.status === 'scheduled' || e.status === 'ongoing',
  );

  return {
    classCount: classRes.pagination.totalItems,
    studentCount: students.items.length,
    examCount: exams.pagination.totalItems,
    upcomingExamCount: upcomingExams.length,
    enrollmentCount: students.items.filter((s) => s.classId).length,
    upcomingExams: upcomingExams.slice(0, 3),
  };
}

/** Export cho Attendance — chỉ lấy classes, không enrollment */
export async function fetchSchoolAdminClassesSimple(
  params: ListQueryParams = {},
): Promise<LecturerClass[]> {
  const { data } = await fetchApiClassesRaw(params);
  return data.map(mapApiClassToLecturerClass);
}

function mapBiometricStatus(status: string): BiometricStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected') return 'rejected';
  return 'pending';
}

function formatBiometricDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapApiBiometricRequest(
  item: ApiBiometricRequest,
  userMap: Map<string, ApiUser>,
): BiometricRequest {
  const student = item.student ?? userMap.get(item.studentId);
  const studentCode = student?.studentCode;
  return {
    id: item.id,
    studentId:
      studentCode && studentCode !== 'none' ? studentCode : item.studentId.slice(0, 8).toUpperCase(),
    studentName: student?.fullName?.trim() || student?.email || 'Unknown student',
    classCode: '—',
    submittedAt: formatBiometricDate(item.createdAt),
    photoUrl: '',
    status: mapBiometricStatus(item.status),
    note: item.reason?.trim() || undefined,
  };
}

/** GET /api/biometric-requests — duyệt sinh trắc học */
export async function fetchSchoolAdminBiometricRequests(
  params: ListQueryParams = {},
): Promise<PagedResult<BiometricRequest>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const [bioRes, userRes] = await Promise.all([
    apiGetPaginated<ApiBiometricRequest[]>(
      `/api/biometric-requests${buildQueryParams({ page, pageSize })}`,
    ),
    fetchApiUsersRaw({ page: 1, pageSize: DEFAULT_PAGE_SIZE }).catch(() => ({
      data: [] as ApiUser[],
      pagination: EMPTY_PAGINATION,
    })),
  ]);

  const userMap = new Map(userRes.data.map((user) => [user.id, user]));

  return {
    items: bioRes.data.map((item) => mapApiBiometricRequest(item, userMap)),
    pagination: bioRes.pagination,
  };
}

// ─── Biometric approve / reject ───────────────────────────────────────────

/** POST /api/biometric-requests/{id}/approve */
export async function approveBiometricRequest(
  id: string,
  reason?: string,
): Promise<void> {
  await apiPost(`/api/biometric-requests/${id}/approve`, { reason: reason ?? null });
}

/** POST /api/biometric-requests/{id}/reject */
export async function rejectBiometricRequest(
  id: string,
  reason?: string,
): Promise<void> {
  await apiPost(`/api/biometric-requests/${id}/reject`, { reason: reason ?? null });
}

// ─── User CRUD ────────────────────────────────────────────────────────────

/** GET /api/users — tất cả users (admin scope) */
export async function fetchUsers(
  params: ListQueryParams = {},
): Promise<PagedResult<ApiUser>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data, pagination } = await apiGetPaginated<ApiUser[]>(
    `/api/users${buildQueryParams({ page, pageSize })}`,
  );
  return { items: data, pagination };
}

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  role: 'student' | 'lecturer';
  studentCode?: string | null;
  institutionId?: string | null;
  phone?: string | null;
}

/** POST /api/users — tạo student hoặc lecturer */
export async function createUser(payload: CreateUserPayload): Promise<ApiUser> {
  return apiPost<ApiUser>('/api/users', payload);
}

/** PUT /api/users/{id} — cập nhật thông tin / trạng thái */
export async function updateUser(
  id: string,
  payload: Partial<{ fullName: string; phone: string; status: string; role: string; studentCode: string }>,
): Promise<ApiUser> {
  return apiPut<ApiUser>(`/api/users/${id}`, payload);
}

/** DELETE /api/users/{id} */
export async function deleteUser(id: string): Promise<void> {
  await apiDelete(`/api/users/${id}`);
}

/** GET /api/users?role=lecturer — danh sách giảng viên */
export async function fetchLecturers(
  params: ListQueryParams = {},
): Promise<PagedResult<LecturerStudent>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data, pagination } = await apiGetPaginated<ApiUser[]>(
    `/api/users${buildQueryParams({ page, pageSize })}`,
  );
  const lecturers = data
    .filter((u) => ['lecturer', 'instructor', 'teacher'].includes(u.role.trim().toLowerCase()))
    .map(mapApiUserToLecturerStudent);
  return { items: lecturers, pagination: { ...pagination, totalItems: lecturers.length } };
}

// ─── Class CRUD ───────────────────────────────────────────────────────────

export interface CreateClassPayload {
  institutionId: string;
  lecturerId: string;
  courseName: string;
  courseCode?: string | null;
  semester: string;
  academicYear: string;
  startDate?: string | null;
  endDate?: string | null;
}

/** POST /api/classes */
export async function createClass(payload: CreateClassPayload): Promise<ApiClass> {
  return apiPost<ApiClass>('/api/classes', payload);
}

/** PUT /api/classes/{id} */
export async function updateClass(
  id: string,
  payload: Partial<CreateClassPayload>,
): Promise<ApiClass> {
  return apiPut<ApiClass>(`/api/classes/${id}`, payload);
}

/** DELETE /api/classes/{id} */
export async function deleteClass(id: string): Promise<void> {
  await apiDelete(`/api/classes/${id}`);
}

// ─── Enrollment ───────────────────────────────────────────────────────────

/** POST /api/enrollments — ghi danh sinh viên vào lớp */
export async function createEnrollment(
  classId: string,
  studentId: string,
): Promise<void> {
  await apiPost('/api/enrollments', { classId, studentId });
}

/** DELETE /api/enrollments/{classId}/{studentId} */
export async function deleteEnrollment(
  classId: string,
  studentId: string,
): Promise<void> {
  await apiDelete(`/api/enrollments/${classId}/${studentId}`);
}

/** GET /api/classes/{classId}/enrollments */
export async function fetchClassEnrollments(classId: string): Promise<ApiEnrollment[]> {
  return apiGet<ApiEnrollment[]>(`/api/classes/${classId}/enrollments`);
}

// ─── Wallet ───────────────────────────────────────────────────────────────

/** GET /api/wallets/institution/{institutionId} */
export async function fetchWallet(institutionId: string): Promise<ApiWallet> {
  return apiGet<ApiWallet>(`/api/wallets/institution/${institutionId}`);
}

/** GET /api/transactions/wallet/{walletId} */
export async function fetchWalletTransactions(
  walletId: string,
  params: ListQueryParams = {},
): Promise<PagedResult<ApiTransaction>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const { data, pagination } = await apiGetPaginated<ApiTransaction[]>(
    `/api/transactions/wallet/${walletId}${buildQueryParams({ page, pageSize })}`,
  );
  return { items: data, pagination };
}

/** POST /api/wallets/top-up */
export async function topUpWallet(payload: {
  institutionId: string;
  amount: number;
  description?: string;
}): Promise<{ paymentUrl?: string }> {
  return apiPost<{ paymentUrl?: string }>('/api/wallets/top-up', payload);
}

// ─── Exam Participations ─────────────────────────────────────────────────

/** GET /api/exam-participations?examSlotId=... */
export async function fetchExamParticipations(
  examSlotId: string,
  params: ListQueryParams = {},
): Promise<PagedResult<ApiExamParticipation>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 100;
  const { data, pagination } = await apiGetPaginated<ApiExamParticipation[]>(
    `/api/exam-participations${buildQueryParams({ examSlotId, page, pageSize })}`,
  );
  return { items: data, pagination };
}

/** POST /api/exam-participations — thêm sinh viên vào kỳ thi */
export async function createExamParticipation(payload: {
  examSlotId: string;
  studentId: string;
}): Promise<ApiExamParticipation> {
  return apiPost<ApiExamParticipation>('/api/exam-participations', {
    ...payload,
    status: 'Absent',
  });
}

/** PUT /api/exam-participations/{examSlotId}/status — cập nhật trạng thái */
export async function updateParticipationStatus(
  examSlotId: string,
  status: ParticipationStatus,
): Promise<void> {
  await apiPut(`/api/exam-participations/${examSlotId}/status`, { status });
}

/** DELETE /api/exam-participations/{examSlotId} — xóa tham gia */
export async function deleteExamParticipation(examSlotId: string): Promise<void> {
  await apiDelete(`/api/exam-participations/${examSlotId}`);
}

// ─── Transactions Deduct ─────────────────────────────────────────────────

/** POST /api/transactions/deduct-attendance */
export async function deductAttendance(payload: DeductAttendancePayload): Promise<ApiTransaction> {
  return apiPost<ApiTransaction>('/api/transactions/deduct-attendance', payload);
}

/** POST /api/transactions/deduct-proctoring */
export async function deductProctoring(payload: DeductProctoringPayload): Promise<ApiTransaction> {
  return apiPost<ApiTransaction>('/api/transactions/deduct-proctoring', payload);
}

// ─── Update own profile ──────────────────────────────────────────────────

/** PUT /api/users/me */
export async function updateMyProfile(payload: UpdateUserMePayload): Promise<ApiUser> {
  return apiPut<ApiUser>('/api/users/me', payload);
}

// ─── Monitoring ───────────────────────────────────────────────────────────

/** GET /api/attendance-sessions — cho School Admin xem tất cả sessions */
export async function fetchAttendanceSessions(
  params: ListQueryParams = {},
): Promise<PagedResult<ApiAttendanceSession>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data, pagination } = await apiGetPaginated<ApiAttendanceSession[]>(
    `/api/attendance-sessions${buildQueryParams({ page, pageSize })}`,
  );
  return { items: data, pagination };
}
