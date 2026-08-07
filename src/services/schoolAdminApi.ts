/**
 * API SchoolAdmin — classes, users, enrollments, exam-slots.
 * Enrollment là optional (SchoolAdmin có thể bị 403 — không làm fail các API khác).
 */
import { getInitialsFromName } from './authApi';
import { ApiError, apiDelete, apiGet, apiGetAllPages, apiGetPaginated, apiPost, apiPut, buildQueryParams } from './apiClient';
import type {
  ApiBiometricRequest,
  ApiAttendanceRecord,
  ApiAttendanceSession,
  ApiClass,
  ApiEnrollment,
  ApiExamParticipation,
  ApiExamQuestion,
  ApiExamSlot,
  ApiInstitution,
  ApiQuestionOption,
  ApiStudentExamRecord,
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
import type {
  BrowserViolationResponse,
  BrowserViolationType,
  ExamParticipationStatusResponse,
  ExamRealtimeStateResponse,
} from '../types/termination';

const DEFAULT_PAGE_SIZE = 50;

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
};

/** BE giới hạn pageSize tối đa 100 (mọi endpoint phân trang) — nếu caller xin nhiều hơn (ý muốn
 *  "lấy hết" trong 1 lần thay vì phân trang thật), tự động gộp nhiều trang 100 qua apiGetAllPages
 *  thay vì gọi thẳng 1 trang lớn (sẽ bị BE trả 400). */
async function fetchPagedOrAll<T>(
  pathBuilder: (page: number, pageSize: number) => string,
  page: number,
  pageSize: number,
): Promise<{ data: T[]; pagination: PaginationMeta }> {
  if (pageSize <= 100) {
    return apiGetPaginated<T[]>(pathBuilder(page, pageSize));
  }
  const data = await apiGetAllPages<T>(pathBuilder);
  return { data, pagination: { page: 1, pageSize: data.length || 1, totalItems: data.length, totalPages: 1 } };
}

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
    code: item.courseCode ?? '—',
    name: item.courseName,
    facultyId: getFacultyByCourseCode(item.courseCode).id,
    semester: `${item.semester} · ${item.academicYear}`,
    schedule: `${item.startDate} → ${item.endDate}`,
    room: '—',
    studentCount: enrollments.length,
    status: deriveClassStatus(item.startDate, item.endDate),
    attendanceRate: 0,
    lecturerId: item.lecturerId ?? '',
    lecturerName: item.lecturer?.fullName ?? '—',
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
    createdAt: item.createdAt,
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
    proctorId: slot.proctor?.id ?? slot.lecturer?.id,
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
  try {
    return await fetchPagedOrAll<ApiClass>(
      (p, ps) => `/api/classes${buildQueryParams({ page: p, pageSize: ps })}`,
      page, pageSize,
    );
  } catch (e) {
    // Backend trả về lỗi (403 no-institution, 400 success:false, v.v.) → trả rỗng
    console.warn('[fetchApiClassesRaw]', e instanceof Error ? e.message : e);
    return { data: [] as ApiClass[], pagination: EMPTY_PAGINATION };
  }
}

/** GET /api/users — raw */
async function fetchApiUsersRaw(params: ListQueryParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  return fetchPagedOrAll<ApiUser>(
    (p, ps) => `/api/users${buildQueryParams({ page: p, pageSize: ps })}`,
    page, pageSize,
  );
}

/** Lấy số lượng student + lecturer trong một lần fetch (dùng cho dashboard KPI) */
export async function fetchUserRoleCounts(): Promise<{ students: number; lecturers: number }> {
  const data = await apiGetAllPages<ApiUser>(
    (page, pageSize) => `/api/users${buildQueryParams({ page, pageSize })}`,
  );
  const students  = data.filter((u) => u.role.trim().toLowerCase() === 'student').length;
  const lecturers = data.filter((u) =>
    ['lecturer', 'instructor', 'teacher'].includes(u.role.trim().toLowerCase()),
  ).length;
  return { students, lecturers };
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
  } catch {
    return { items: [], pagination: EMPTY_PAGINATION };
  }
}

/** GET /api/classes — kèm số SV từ per-class enrollment count */
export async function fetchSchoolAdminClasses(
  params: ListQueryParams = {},
): Promise<PagedResult<LecturerClass>> {
  const classRes = await fetchApiClassesRaw(params);
  const classItems = classRes.data.map(mapApiClassToLecturerClass);

  // Fetch enrollment counts per-class (parallel, silent on error)
  const counts = await Promise.allSettled(
    classItems.map((cls) =>
      apiGet<ApiEnrollment[]>(`/api/classes/${cls.id}/enrollments`).catch(() => [] as ApiEnrollment[]),
    ),
  );
  counts.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      classItems[i].studentCount = result.value.length;
    }
  });

  return { items: classItems, pagination: classRes.pagination };
}

/** GET /api/users (Student) — kèm lớp từ enrollment nếu có quyền */
export async function fetchSchoolAdminStudents(
  params: ListQueryParams & { institutionId?: string } = {},
): Promise<PagedResult<LecturerStudent>> {
  const { institutionId } = params;
  const [userRes, classRes, enrollmentRes] = await Promise.all([
    fetchApiUsersRaw(params),
    fetchApiClassesRaw({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    tryFetchEnrollments({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  const classItems = classRes.data.map(mapApiClassToLecturerClass);
  const classMap = new Map(classItems.map((cls) => [cls.id, cls]));

  // Filter client-side theo institution — backend /api/users chưa scope theo institution
  const students = applyEnrollmentsToStudents(
    userRes.data
      .filter((user) => user.role.trim().toLowerCase() === 'student')
      .filter((user) => !institutionId || user.institutionId === institutionId)
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
    fetchPagedOrAll<ApiExamSlot>(
      (p, ps) => `/api/exam-slots${buildQueryParams({ page: p, pageSize: ps })}`,
      page, pageSize,
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

/** GET /api/exam-slots/{id}/realtime-state — Lecturer/SchoolAdmin/SuperAdmin. Snapshot ban đầu
 *  (danh sách sinh viên + online/submit/disqualify/violation count) trước khi nghe tiếp qua SignalR
 *  hub Exams (JoinLecturerDashboard) để cập nhật live — xem Hubs/ExamHub.cs. */
export async function fetchExamRealtimeState(examId: string): Promise<ExamRealtimeStateResponse> {
  return apiGet<ExamRealtimeStateResponse>(`/api/exam-slots/${examId}/realtime-state`);
}

export interface CreateExamSlotPayload {
  classId: string;
  examName: string;
  startTime: string;
  endTime: string;
  expectedDurationMinutes?: number;
  status?: 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';
  // lecturerId KHÔNG dùng để gán giám thị coi thi — BE dùng field này để ghi đè luôn giảng viên
  // phụ trách của CẢ LỚP (Class.LecturerId), không phải riêng buổi thi. Dùng proctorId bên dưới
  // (cột proctor_id riêng ở BE, thêm 07/08) để chỉ định giám thị coi thi khác giảng viên lớp.
  lecturerId?: string;
  proctorId?: string;
}

/** POST /api/exam-slots */
export async function createExamSlot(payload: CreateExamSlotPayload): Promise<ApiExamSlot> {
  return apiPost<ApiExamSlot>('/api/exam-slots', payload);
}

/** PUT /api/exam-slots/{id} */
export async function updateExamSlot(id: string, payload: Partial<CreateExamSlotPayload>): Promise<ApiExamSlot> {
  return apiPut<ApiExamSlot>(`/api/exam-slots/${id}`, payload);
}

/** DELETE /api/exam-slots/{id} */
export async function deleteExamSlot(id: string): Promise<void> {
  await apiDelete(`/api/exam-slots/${id}`);
}

/** Tổng hợp dashboard */
export async function fetchSchoolAdminOverviewStats(institutionId?: string) {
  const [classRes, students, exams] = await Promise.all([
    fetchSchoolAdminClasses({ page: 1, pageSize: 50 }),
    fetchSchoolAdminStudents({ page: 1, pageSize: 50, institutionId }),
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
      studentCode && studentCode !== 'none' ? studentCode : (item.studentId ?? '').slice(0, 8).toUpperCase(),
    studentName: student?.fullName?.trim() || student?.email || 'Unknown student',
    studentEmail: student?.email ?? '',
    classCode: '—',
    submittedAt: formatBiometricDate(item.createdAt),
    frontImageUrl: item.frontImageUrl ?? null,
    leftImageUrl: item.leftImageUrl ?? null,
    rightImageUrl: item.rightImageUrl ?? null,
    status: mapBiometricStatus(item.status),
    note: item.reason?.trim() || undefined,
  };
}

/**
 * POST /api/storage/signed-url — lấy signed URL để hiển thị ảnh khuôn mặt.
 *
 * BE's Front/Left/RightImageUrl chỉ là passthrough thẳng cột path trong DB (Helpers/AcademicMapper.cs),
 * không hề ký sẵn. Giá trị cột đó đã đổi qua thời gian: trước đây là path cục bộ kiểu
 * "uploads/biometrics/xxx.jpg" (không khớp bucket Supabase "biometric-faces"), còn từ bản cập nhật
 * AI service (BiometricRequestService.cs) thì lưu THẲNG URL đầy đủ trả về từ FastAPI AI
 * (`aiResponse.AvatarUrl`, có thể ở project Supabase khác). Ký lại 1 URL đã đầy đủ như path thô sẽ
 * fail — nên tự nhận diện: nếu đã là URL http(s) thì dùng thẳng, chỉ ký khi thực sự là bare path.
 */
export async function fetchSignedFaceUrl(path: string): Promise<string | null> {
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const res = await apiPost<{ signedUrl?: string }>(
      `/api/storage/signed-url?bucket=biometric-faces&path=${encodeURIComponent(path)}&expiresInSeconds=3600`,
    );
    return res?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** GET /api/biometric-requests — duyệt sinh trắc học (chỉ của institution mình) */
export async function fetchSchoolAdminBiometricRequests(
  params: ListQueryParams & { institutionId?: string } = {},
): Promise<PagedResult<BiometricRequest>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const { institutionId } = params;

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

  // Filter client-side theo institution — backend trả tất cả requests
  const filtered = institutionId
    ? bioRes.data.filter((item) => {
        const student = item.student ?? userMap.get(item.studentId);
        return student?.institutionId === institutionId;
      })
    : bioRes.data;

  return {
    items: filtered.map((item) => mapApiBiometricRequest(item, userMap)),
    pagination: bioRes.pagination,
  };
}

// ─── Biometric approve / reject ───────────────────────────────────────────

/** POST /api/biometric-requests/{id}/approve */
export async function approveBiometricRequest(requestId: string, reason: string): Promise<void> {
  await apiPost<null>(`/api/biometric-requests/${requestId}/approve`, { reason: reason.trim() });
}

/** POST /api/biometric-requests/{id}/reject */
export async function rejectBiometricRequest(requestId: string, reason: string): Promise<void> {
  await apiPost<null>(`/api/biometric-requests/${requestId}/reject`, { reason: reason.trim() });
}

/**
 * Lấy URL ảnh biometric approved của student (dùng cho verify trước khi thi) — mỗi student giờ chỉ
 * có tối đa 1 request đang approved tại 1 thời điểm (1 request = 1 lần nộp cả bộ 3 ảnh), nên chỉ cần
 * lấy request approved mới nhất, dùng thẳng faceImageUrl (đã là URL Supabase đầy đủ).
 * Trả null nếu chưa có biometric approved hoặc BE không cho phép.
 */
export async function fetchMyApprovedBiometricPhoto(studentUuid: string): Promise<string | null> {
  try {
    const res = await apiGetPaginated<ApiBiometricRequest[]>(
      `/api/biometric-requests${buildQueryParams({ page: 1, pageSize: 50 })}`,
    );

    const approved = res.data
      .filter((r) => r.studentId === studentUuid && r.status?.toLowerCase() === 'approved' && r.faceImageUrl)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (approved.length === 0) return null;

    return await fetchSignedFaceUrl(approved[0].faceImageUrl!);
  } catch {
    return null;
  }
}

// ─── User CRUD ────────────────────────────────────────────────────────────

/** sort BE hỗ trợ (UserRepository.GetAllAsync): 'fullname' | '-fullname' | 'email' | '-email' —
 *  bất kỳ giá trị nào khác (kể cả undefined) đều rơi về mặc định OrderByDescending(CreatedAt). */
export interface FetchUsersParams extends ListQueryParams {
  search?: string;
  sort?: 'fullname' | '-fullname' | 'email' | '-email';
}

/** GET /api/users — tất cả users (admin scope) */
export async function fetchUsers(
  params: FetchUsersParams = {},
): Promise<PagedResult<ApiUser>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const { search, sort } = params;
  const { data, pagination } = await fetchPagedOrAll<ApiUser>(
    (p, ps) => `/api/users${buildQueryParams({ page: p, pageSize: ps, search, sort })}`,
    page, pageSize,
  );
  return { items: data, pagination };
}

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  role: 'Student' | 'Lecturer' | 'SchoolAdmin';
  studentCode?: string | null;
  institutionId?: string | null;
  phone?: string | null;
}

/** POST /api/users — tạo student hoặc lecturer */
export async function createUser(payload: CreateUserPayload): Promise<ApiUser> {
  return apiPost<ApiUser>('/api/users', payload);
}

export interface BulkImportUserRowResult {
  row: number;
  email: string | null;
  success: boolean;
  userId: string | null;
  error: string | null;
}

export interface BulkImportUsersResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkImportUserRowResult[];
}

/** POST /api/users/bulk-import — file .xlsx/.csv, tối đa 5MB / 500 dòng.
 * Cột: Email, Password, FullName, Role, StudentCode, Phone, InstitutionId (School Admin gọi thì
 * InstitutionId trong file bị BE bỏ qua, tự gán theo institution của chính School Admin đó). */
export async function bulkImportUsers(file: File): Promise<BulkImportUsersResult> {
  const formData = new FormData();
  formData.append('file', file);
  return apiPost<BulkImportUsersResult>('/api/users/bulk-import', formData);
}

/** PUT /api/users/{id} — cập nhật thông tin / trạng thái */
export async function updateUser(
  id: string,
  payload: Partial<{ fullName: string; phone: string; status: string; role: string; studentCode: string; institutionId: string }>,
): Promise<ApiUser> {
  return apiPut<ApiUser>(`/api/users/${id}`, payload);
}

/** DELETE /api/users/{id} */
export async function deleteUser(id: string): Promise<void> {
  await apiDelete(`/api/users/${id}`);
}

/** GET /api/users?role=lecturer — danh sách giảng viên */
export async function fetchLecturers(
  params: ListQueryParams & { institutionId?: string } = {},
): Promise<PagedResult<LecturerStudent>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const { institutionId } = params;
  const { data, pagination } = await fetchPagedOrAll<ApiUser>(
    (p, ps) => `/api/users${buildQueryParams({ page: p, pageSize: ps })}`,
    page, pageSize,
  );
  // Filter client-side theo institution — backend /api/users chưa scope theo institution
  const lecturers = data
    .filter((u) => ['lecturer', 'instructor', 'teacher'].includes(u.role.trim().toLowerCase()))
    .filter((u) => !institutionId || u.institutionId === institutionId)
    .map(mapApiUserToLecturerStudent);
  return { items: lecturers, pagination: { ...pagination, totalItems: lecturers.length } };
}

// ─── Class CRUD ───────────────────────────────────────────────────────────

export interface CreateClassPayload {
  institutionId?: string | null;
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

// ─── Student exam slots ────────────────────────────────────────────────────

/**
 * Fetch exam slots cho student hiện tại.
 * Flow: GET /api/classes/my-classes → với mỗi lớp GET /api/exam-slots/class/{classId}
 * Trả về tất cả exam slots (scheduled + ongoing + completed).
 */
export async function fetchStudentExamSlots(_studentId: string): Promise<ExamSlot[]> {
  const myClasses = await apiGet<ApiClass[]>('/api/classes/my-classes').catch(() => [] as ApiClass[]);
  if (myClasses.length === 0) return [];

  const classMap = new Map<string, LecturerClass>(
    myClasses.map((cls) => [cls.id, mapApiClassToLecturerClass(cls)]),
  );

  const slotArrays = await Promise.all(
    myClasses.map((cls) =>
      apiGet<ApiExamSlot[]>(`/api/exam-slots/class/${cls.id}`).catch(() => [] as ApiExamSlot[]),
    ),
  );

  const seen = new Set<string>();
  return slotArrays.flat()
    .filter((slot) => {
      if (seen.has(slot.id)) return false;
      seen.add(slot.id);
      return true;
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .map((slot) => mapApiExamSlot(slot, classMap));
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

/** Giống fetchClassEnrollments nhưng đảm bảo mỗi enrollment có sẵn `.student` — BE không phải
 *  lúc nào cũng trả kèm, nên phải tự GET /api/users/{id} bù cho các enrollment còn thiếu. */
export async function fetchClassEnrollmentsWithStudents(classId: string): Promise<ApiEnrollment[]> {
  const enrollments = await fetchClassEnrollments(classId);
  return Promise.all(
    enrollments.map(async (e) => {
      if (e.student) return e;
      try {
        const user = await apiGet<ApiUser>(`/api/users/${e.studentId}`);
        return { ...e, student: user };
      } catch {
        return e;
      }
    }),
  );
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

/** POST /api/wallets/top-up — trả về payment URL string */
export async function topUpWallet(payload: {
  institutionId: string;
  amount: number;
  description?: string;
}): Promise<string | null> {
  const result = await apiPost<string | null>('/api/wallets/top-up', payload);
  return result ?? null;
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

/** POST /api/exam-participations — thêm sinh viên vào kỳ thi (status mặc định Absent, chỉ chuyển
 *  Joined khi gọi /join — BE giờ từ chối tạo participation nếu gửi kèm status khác Absent). */
export async function createExamParticipation(payload: {
  examSlotId: string;
  studentId: string;
}): Promise<ApiExamParticipation> {
  return apiPost<ApiExamParticipation>('/api/exam-participations', payload);
}

/** POST /api/exam-participations/{id}/join — student vào phòng thi, BE ghi actualStart + status=Joined.
 *  BE giờ bắt buộc kèm ảnh liveCapture để verify khuôn mặt (so với BiometricData.FaceVector đã approved)
 *  trước khi cho join — thiếu file này BE trả 400. Gửi multipart/form-data field tên "liveCapture" đúng
 *  tên param IFormFile ở ExamparticipationController.Join. */
export async function joinExamParticipation(participationId: string, liveCapture: Blob): Promise<void> {
  const formData = new FormData();
  formData.append('liveCapture', liveCapture, 'live-capture.jpg');
  await apiPost(`/api/exam-participations/${participationId}/join`, formData);
}

/** POST /api/exam-participations/{id}/heartbeat — ping định kỳ để báo student còn online */
export async function sendExamHeartbeat(participationId: string): Promise<void> {
  await apiPost(`/api/exam-participations/${participationId}/heartbeat`, {
    clientTime: new Date().toISOString(),
  });
}

/** POST /api/exam-participations/{id}/submit — nộp bài, BE ghi actualEnd + status=Submitted */
export async function submitExamParticipation(
  participationId: string,
  recordingVideoPath?: string,
): Promise<void> {
  await apiPost(`/api/exam-participations/${participationId}/submit`, {
    recordingVideoPath: recordingVideoPath ?? null,
  });
}

/** POST /api/exam-participations/{id}/leave — student thoát giữa chừng, BE set status=Left */
export async function leaveExamParticipation(participationId: string, reason?: string): Promise<void> {
  await apiPost(`/api/exam-participations/${participationId}/leave`, {
    reason: reason ?? null,
  });
}

/** PUT /api/exam-participations/{id}/status — cập nhật trạng thái (dùng cho Submitted, Left...) */
export async function updateParticipationStatus(
  participationId: string,
  status: ParticipationStatus,
): Promise<void> {
  await apiPut(`/api/exam-participations/${participationId}/status`, { status });
}

/**
 * GET /api/exam-participations/{id}/status — trạng thái realtime của participation, dùng để:
 * (1) check ngay khi vào trang thi / F5 / mất-rồi-có-mạng-lại, không đợi SignalR;
 * (2) biết bài thi đã bị terminate (disqualify do vi phạm trình duyệt) hay chưa.
 * Response shape khớp ExamParticipationStatusResponseDto (BE).
 */
export async function fetchExamParticipationStatus(
  participationId: string,
): Promise<ExamParticipationStatusResponse> {
  return apiGet<ExamParticipationStatusResponse>(`/api/exam-participations/${participationId}/status`);
}

/**
 * POST /api/browser-violations — báo cáo hành vi rời khỏi màn hình thi (đổi tab, mất focus cửa
 * sổ, thoát fullscreen). BE tự đếm dồn và quyết định khi nào terminate participation (>=3 lần).
 * Response trả về examTerminated ngay lập tức — không cần đợi SignalR mới biết vừa bị terminate.
 */
export async function reportBrowserViolation(payload: {
  participationId: string;
  violationType: BrowserViolationType;
}): Promise<BrowserViolationResponse> {
  return apiPost<BrowserViolationResponse>('/api/browser-violations', {
    participationId: payload.participationId,
    violationType: payload.violationType,
  });
}

/** POST /api/exam-participations/{id}/disqualify — đình chỉ student */
export async function disqualifyParticipation(
  participationId: string,
  reason: string,
): Promise<void> {
  await apiPost(`/api/exam-participations/${participationId}/disqualify`, { reason });
}

/** POST /api/exam-participations/{id}/void — huỷ kết quả bài thi ĐÃ NỘP (participation.Status ==
 *  Submitted) sau khi lecturer xem lại evidence và phát hiện vi phạm nghiêm trọng — khác với
 *  disqualify (chỉ áp dụng được khi còn đang thi, status Joined). BE chuyển status → Disqualified
 *  và đánh dấu các StudentExamRecord liên quan là Deleted (giữ lại để audit, không tính điểm/báo cáo). */
export async function voidExamParticipation(
  participationId: string,
  reason: string,
): Promise<void> {
  await apiPost(`/api/exam-participations/${participationId}/void`, { reason });
}

/** DELETE /api/exam-participations/{participationId} — xóa tham gia */
export async function deleteExamParticipation(participationId: string): Promise<void> {
  await apiDelete(`/api/exam-participations/${participationId}`);
}

// ─── Exam Questions ─────────────────────────────────────────────────────

export interface CreateQuestionOptionPayload {
  optionLabel: string;
  optionContent: string;
  isCorrect: boolean;
}

export interface CreateExamQuestionPayload {
  examSlotId: string;
  questionType: string;
  questionContent: string;
  audioUrl?: string | null;
  imageUrl?: string | null;
  points: number;
  displayOrder: number;
  options?: CreateQuestionOptionPayload[];
}

export interface UpdateExamQuestionPayload {
  questionType: string;
  questionContent: string;
  audioUrl?: string | null;
  imageUrl?: string | null;
  points: number;
  displayOrder: number;
}

/** GET /api/exam-questions?examSlotId=... — Student không thấy isCorrect (BE trả null) */
export async function fetchExamQuestions(
  examSlotId: string,
  params: ListQueryParams = {},
): Promise<PagedResult<ApiExamQuestion>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 100;
  const { data, pagination } = await fetchPagedOrAll<ApiExamQuestion>(
    (p, ps) => `/api/exam-questions${buildQueryParams({ examSlotId, page: p, pageSize: ps })}`,
    page, pageSize,
  );
  return { items: data, pagination };
}

/** POST /api/exam-questions — có thể kèm luôn options trong 1 request */
export async function createExamQuestion(payload: CreateExamQuestionPayload): Promise<ApiExamQuestion> {
  return apiPost<ApiExamQuestion>('/api/exam-questions', payload);
}

/** PUT /api/exam-questions/{id} — chỉ sửa field câu hỏi, không sửa options */
export async function updateExamQuestion(
  id: string,
  payload: UpdateExamQuestionPayload,
): Promise<ApiExamQuestion> {
  return apiPut<ApiExamQuestion>(`/api/exam-questions/${id}`, payload);
}

/** DELETE /api/exam-questions/{id} */
export async function deleteExamQuestion(id: string): Promise<void> {
  await apiDelete(`/api/exam-questions/${id}`);
}

/** POST /api/exam-questions/{questionId}/options */
export async function createQuestionOption(
  questionId: string,
  payload: CreateQuestionOptionPayload,
): Promise<ApiQuestionOption> {
  return apiPost<ApiQuestionOption>(`/api/exam-questions/${questionId}/options`, payload);
}

/** PUT /api/exam-questions/options/{optionId} */
export async function updateQuestionOption(
  optionId: string,
  payload: CreateQuestionOptionPayload,
): Promise<ApiQuestionOption> {
  return apiPut<ApiQuestionOption>(`/api/exam-questions/options/${optionId}`, payload);
}

/** DELETE /api/exam-questions/options/{optionId} */
export async function deleteQuestionOption(optionId: string): Promise<void> {
  await apiDelete(`/api/exam-questions/options/${optionId}`);
}

// ─── Student Exam Records (nộp bài + chấm điểm) ──────────────────────────

export interface SubmitStudentExamRecordPayload {
  examSlotId: string;
  answers: Array<{ questionId: string; optionId?: string; selectedOption?: string; answerText?: string }>;
  durationSeconds?: number;
}

/** POST /api/student-exam-records/submit — BE tự chấm điểm, trả finalScore */
export async function submitStudentExamRecord(
  payload: SubmitStudentExamRecordPayload,
): Promise<ApiStudentExamRecord> {
  return apiPost<ApiStudentExamRecord>('/api/student-exam-records/submit', payload);
}

/** GET /api/student-exam-records?studentId=&examSlotId= — xem điểm đã nộp */
export async function fetchStudentExamRecords(
  params: ListQueryParams & { studentId?: string; examSlotId?: string } = {},
): Promise<PagedResult<ApiStudentExamRecord>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 100;
  const { data, pagination } = await fetchPagedOrAll<ApiStudentExamRecord>(
    (p, ps) => `/api/student-exam-records${buildQueryParams({
      studentId: params.studentId,
      examSlotId: params.examSlotId,
      page: p,
      pageSize: ps,
    })}`,
    page, pageSize,
  );
  return { items: data, pagination };
}

export interface GradeStudentExamRecordPayload {
  grades: Array<{ questionId: string; awardedPoints: number }>;
}

/** PUT /api/student-exam-records/{id}/manual-grade — Lecturer/SchoolAdmin/SuperAdmin. BE tự validate
 *  (chỉ cho chấm câu Essay/needsManualMarking, không vượt max points, không câu trùng/lạ) và tự tính
 *  lại finalScore/status — không cần FE tự parse/build lại ExamRecord JSON như trước nữa. */
export async function gradeStudentExamRecord(
  id: string,
  payload: GradeStudentExamRecordPayload,
): Promise<ApiStudentExamRecord> {
  return apiPut<ApiStudentExamRecord>(`/api/student-exam-records/${id}/manual-grade`, payload);
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

// ─── Institution ─────────────────────────────────────────────────────────

/** GET /api/institutions/{id} — lấy thông tin trường */
export async function fetchInstitution(id: string): Promise<ApiInstitution | null> {
  try {
    return await apiGet<ApiInstitution>(`/api/institutions/${id}`);
  } catch {
    return null;
  }
}

// ─── Update own profile ──────────────────────────────────────────────────

/** PUT /api/users/me */
export async function updateMyProfile(payload: UpdateUserMePayload): Promise<ApiUser> {
  return apiPut<ApiUser>('/api/users/me', payload);
}

// ─── Student attendance history ───────────────────────────────────────────

export interface StudentAttendanceRecord {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  className: string;
  classCode: string;
  lecturerName: string | null;
  startTime: string;   // 'HH:MM'
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime: string | null;
  examName: string | null;
}

/**
 * BE hiện trả `session.examSlotId` LUÔN null trong response của /api/attendance-records?expand=session
 * (AcademicMapper.MapRecordAsync quên gán field này khi build AttendanceSessionSummaryDto — đã báo BE
 * sửa, chỉ cần thêm `ExamSlotId = session.ExamSlotId` là xong). Trong lúc chờ fix, suy luận bài thi
 * bằng cách khớp thời điểm (checkin, hoặc startTime của session nếu absent/excused không có checkin)
 * với khung giờ [startTime, endTime] của các exam slot CÙNG lớp — 2 exam của cùng 1 lớp thường không
 * trùng giờ nhau nên đủ chính xác cho mục đích hiển thị. Ưu tiên slot có startTime gần mốc nhất nếu
 * (hiếm khi) có nhiều slot cùng chứa mốc thời gian đó.
 */
function findExamSlotByTime(classId: string, referenceIso: string | null, slots: ExamSlot[]): ExamSlot | null {
  if (!referenceIso) return null;
  const t = new Date(referenceIso).getTime();
  const candidates = slots.filter((s) => {
    if (s.classId !== classId) return false;
    const start = new Date(s.startTime).getTime();
    const end = new Date(s.endTime).getTime();
    return t >= start && t <= end;
  });
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
}

function mapAttendanceStatus(s: string): StudentAttendanceRecord['status'] {
  const v = s.trim().toLowerCase();
  if (v === 'present') return 'present';
  if (v === 'late') return 'late';
  if (v === 'excused') return 'excused';
  return 'absent';
}

/**
 * Map examSlotId → trạng thái điểm danh của CHÍNH student đang gọi, cho những session có gắn
 * examSlotId (điểm danh mở cho đúng bài thi đó). Dùng để chặn ở FE: chưa được lecturer điểm danh
 * Present/Late thì chưa cho vào thi. Đây chỉ là gate UX — chặn thật cần BE (ExamWorkflowService.
 * JoinAsync hiện chưa kiểm tra điều kiện này).
 */
export async function fetchMyExamAttendanceStatus(
  studentId: string,
): Promise<Record<string, StudentAttendanceRecord['status']>> {
  const records = await apiGetAllPages<ApiAttendanceRecord>(
    (page, pageSize) => `/api/attendance-records${buildQueryParams({ studentId, expand: 'session', page, pageSize })}`,
  ).catch(() => [] as ApiAttendanceRecord[]);

  const result: Record<string, StudentAttendanceRecord['status']> = {};
  records.forEach((rec) => {
    const examSlotId = rec.session?.examSlotId;
    if (!examSlotId) return;
    result[examSlotId] = mapAttendanceStatus(rec.status);
  });
  return result;
}

function timePart(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function datePart(iso: string) {
  return iso.slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Lấy lịch sử điểm danh của student:
 * 1. GET /api/attendance-records?studentId={id}&expand=session — Student role được phép,
 *    trả kèm session tóm tắt (classId, startTime). KHÔNG dùng GET /api/attendance-sessions
 *    vì endpoint đó chỉ cho SuperAdmin/SchoolAdmin/Lecturer, Student gọi sẽ bị 403 và bị
 *    .catch() nuốt lỗi âm thầm thành mảng rỗng → mọi record bị lọc mất, trang luôn trống.
 * 2. GET /api/classes/my-classes&expand=lecturer — map classId → tên môn, mã môn, giảng viên.
 * 3. Join để lấy className, classCode, lecturerName, ngày giờ.
 */
export async function fetchStudentAttendanceHistory(
  studentId: string,
): Promise<StudentAttendanceRecord[]> {
  const [records, classes, examSlots] = await Promise.all([
    apiGetAllPages<ApiAttendanceRecord>(
      (page, pageSize) => `/api/attendance-records${buildQueryParams({ studentId, expand: 'session', page, pageSize })}`,
    ).catch(() => [] as ApiAttendanceRecord[]),
    apiGetAllPages<ApiClass>(
      (page, pageSize) => `/api/classes/my-classes${buildQueryParams({ expand: 'lecturer', page, pageSize })}`,
    ).catch(() => [] as ApiClass[]),
    fetchStudentExamSlots(studentId).catch(() => [] as ExamSlot[]),
  ]);

  // Nếu studentId param không được hỗ trợ → filter client-side
  const myRecords = records.filter(
    (r) => !studentId || r.studentId === studentId,
  );

  if (myRecords.length === 0) return [];

  const classMap = new Map(classes.map((c) => [c.id, c]));

  return myRecords
    .map((rec): StudentAttendanceRecord | null => {
      const session = rec.session;
      if (!session) return null;
      const cls = classMap.get(session.classId);
      // BE (commit a786b9e "Fix bug thiếu mapper") giờ trả đúng session.examSlotId — ưu tiên dùng
      // thẳng field này (chính xác 100%). Fallback về suy luận khung giờ chỉ khi field vẫn null
      // (vd BE production chưa deploy bản fix, hoặc session không gắn với exam nào).
      const examSlot = session.examSlotId
        ? examSlots.find((s) => s.id === session.examSlotId) ?? null
        : findExamSlotByTime(session.classId, rec.checkinAt ?? session.startTime, examSlots);
      return {
        id: rec.id,
        date: datePart(session.startTime),
        className: cls?.courseName ?? 'Unknown class',
        classCode: cls?.courseCode ?? session.classId.slice(0, 8),
        lecturerName: cls?.lecturer?.fullName ?? null,
        startTime: timePart(session.startTime),
        status: mapAttendanceStatus(rec.status),
        checkInTime: rec.checkinAt ? timePart(rec.checkinAt) : null,
        examName: examSlot?.examName ?? null,
      };
    })
    .filter((r): r is StudentAttendanceRecord => r !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Monitoring ───────────────────────────────────────────────────────────

/** GET /api/attendance-sessions — cho School Admin xem tất cả sessions */
export async function fetchAttendanceSessions(
  params: ListQueryParams = {},
): Promise<PagedResult<ApiAttendanceSession>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data, pagination } = await apiGetPaginated<ApiAttendanceSession[]>(
    `/api/attendance-sessions${buildQueryParams({ page, pageSize, expand: 'class' })}`,
  );
  return { items: data, pagination };
}

// ─── Notification Emails ───────────────────────────────────────────────────
// BE's /api/email-test/* — chỉ [Authorize] (mọi role đăng nhập đều gọi được), nhận đúng 1 người
// nhận/lần, không tự tra dữ liệu thật nên FE phải tự truyền email/tên/nội dung. Gửi lỗi không nên
// chặn hành động chính (approve/reject/tạo đề/điểm danh) nên luôn bọc try/catch ở nơi gọi.

/** POST /api/email-test/biometric-approved */
export async function sendBiometricApprovedEmail(payload: { email: string; studentName: string }): Promise<void> {
  await apiPost<null>('/api/email-test/biometric-approved', payload);
}

/** POST /api/email-test/biometric-rejected */
export async function sendBiometricRejectedEmail(
  payload: { email: string; studentName: string; reason: string },
): Promise<void> {
  await apiPost<null>('/api/email-test/biometric-rejected', payload);
}

/** POST /api/email-test/exam-created */
export async function sendExamCreatedEmail(
  payload: { email: string; studentName: string; examName: string; examTime: string },
): Promise<void> {
  await apiPost<null>('/api/email-test/exam-created', payload);
}

/** POST /api/email-test/exam-reminder */
export async function sendExamReminderEmail(
  payload: { email: string; studentName: string; examName: string; examTime: string },
): Promise<void> {
  await apiPost<null>('/api/email-test/exam-reminder', payload);
}

/** POST /api/email-test/attendance-started */
export async function sendAttendanceStartedEmail(
  payload: { email: string; studentName: string; className: string },
): Promise<void> {
  await apiPost<null>('/api/email-test/attendance-started', payload);
}
