/**
 * API SchoolAdmin — classes, users, enrollments, exam-slots.
 * Enrollment là optional (SchoolAdmin có thể bị 403 — không làm fail các API khác).
 */
import { getInitialsFromName } from './authApi';
import { ApiError, apiGetPaginated, apiPost, buildQueryParams } from './apiClient';
import type {
  ApiBiometricRequest,
  ApiClass,
  ApiEnrollment,
  ApiExamSlot,
  ApiUser,
  ListQueryParams,
  PagedResult,
  PaginationMeta,
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

/** POST /api/biometric-requests/{id}/approve */
export async function approveBiometricRequest(requestId: string, reason: string): Promise<void> {
  await apiPost<null>(`/api/biometric-requests/${requestId}/approve`, { reason: reason.trim() });
}

/** POST /api/biometric-requests/{id}/reject */
export async function rejectBiometricRequest(requestId: string, reason: string): Promise<void> {
  await apiPost<null>(`/api/biometric-requests/${requestId}/reject`, { reason: reason.trim() });
}
