/**
 * API Lecturer — attendance sessions, violation logs, exam participations.
 */
import { apiGet, apiGetPaginated, apiPost, apiPut, buildQueryParams } from './apiClient';
import { updateParticipationStatus, disqualifyParticipation } from './schoolAdminApi';
import { fetchExamSlots, fetchSchoolAdminClasses, mapApiClassToLecturerClass } from './schoolAdminApi';
import type {
  ApiAttendanceRecord,
  ApiAttendanceSession,
  ApiExamParticipation,
  ApiViolationLog,
  ListQueryParams,
  PagedResult,
} from '../types/api';
import type {
  AttendanceRecord,
  AttendanceSession,
  BiometricStatus,
  ExamSlot,
  LecturerClass,
  LecturerKpi,
} from '../types/lecturer';
import { getInitialsFromName } from './authApi';

// ─── Helpers ─────────────────────────────────────────────────────────────

function mapAttendanceStatus(status: string): AttendanceRecord['status'] {
  const s = status.trim().toLowerCase();
  if (s === 'present') return 'present';
  if (s === 'late') return 'late';
  if (s === 'excused') return 'excused';
  return 'absent';
}

function mapApiAttendanceRecord(
  record: ApiAttendanceRecord,
): AttendanceRecord {
  const name = record.student?.fullName?.trim() || record.student?.email || 'Unknown';
  return {
    id: record.id,
    studentId: record.student?.studentCode || record.studentId.slice(0, 8),
    rawStudentId: record.studentId,
    name,
    classCode: '—',
    status: mapAttendanceStatus(record.status),
    checkInTime: record.checkinAt
      ? new Date(record.checkinAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : null,
    avatar: null,
    initials: getInitialsFromName(name),
  };
}

// ─── KPIs ─────────────────────────────────────────────────────────────────

/** KPI tổng quan: tính từ classes + exams thật */
export async function fetchLecturerKpis(): Promise<LecturerKpi[]> {
  try {
    const [classRes, examRes] = await Promise.all([
      fetchSchoolAdminClasses({ page: 1, pageSize: 50 }),
      fetchExamSlots({ page: 1, pageSize: 50 }),
    ]);

    const activeClasses = classRes.items.filter((c) => c.status === 'active').length;
    const ongoingExams = examRes.items.filter((e) => e.status === 'ongoing').length;
    const totalStudents = classRes.items.reduce((sum, c) => sum + c.studentCount, 0);

    return [
      { label: 'Active Classes', value: String(activeClasses), icon: '📚', colorClass: 'text-blue-bright', bgGlow: 'uni-kpi-blue', change: null },
      { label: 'Total Students', value: String(totalStudents), icon: '👥', colorClass: 'text-cyan', bgGlow: 'uni-kpi-cyan', change: null },
      { label: 'Ongoing Exams', value: String(ongoingExams), icon: '📝', colorClass: 'text-green', bgGlow: 'uni-kpi-green', change: null },
      { label: 'Violations Today', value: '0', icon: '⚠️', colorClass: 'text-red', bgGlow: 'uni-kpi-red', change: null },
    ];
  } catch {
    return [
      { label: 'Active Classes', value: '—', icon: '📚', colorClass: 'text-blue-bright', bgGlow: 'uni-kpi-blue', change: null },
      { label: 'Total Students', value: '—', icon: '👥', colorClass: 'text-cyan', bgGlow: 'uni-kpi-cyan', change: null },
      { label: 'Ongoing Exams', value: '—', icon: '📝', colorClass: 'text-green', bgGlow: 'uni-kpi-green', change: null },
      { label: 'Violations Today', value: '—', icon: '⚠️', colorClass: 'text-red', bgGlow: 'uni-kpi-red', change: null },
    ];
  }
}

// ─── Attendance Sessions ───────────────────────────────────────────────────

/** GET /api/attendance-sessions — lấy session đang active theo classId */
export async function fetchActiveAttendanceSession(
  classId?: string,
): Promise<AttendanceSession | null> {
  // expand=class — BE chỉ populate session.class khi có tham số này (Helpers/AcademicMapper.cs),
  // không gửi thì className luôn rơi về "Unknown" dù data thật vẫn tồn tại.
  const { data } = await apiGetPaginated<ApiAttendanceSession[]>(
    `/api/attendance-sessions${buildQueryParams({ page: 1, pageSize: 50, expand: 'class' })}`,
  );

  const active = data.find(
    (s) =>
      s.status?.toLowerCase() !== 'closed' &&
      s.status?.toLowerCase() !== 'completed' &&
      s.endTime == null &&
      (!classId || s.classId === classId),
  );

  if (!active) return null;
  return buildAttendanceSession(active);
}

/** POST /api/attendance-sessions — bắt đầu phiên điểm danh mới */
export async function startAttendanceSession(classId: string): Promise<AttendanceSession> {
  const created = await apiPost<ApiAttendanceSession>('/api/attendance-sessions', {
    classId,
    startTime: new Date().toISOString(),
  });
  return buildAttendanceSession(created);
}

/** PUT /api/attendance-sessions/{id} — đóng phiên điểm danh */
export async function endAttendanceSession(
  sessionId: string,
): Promise<{ success: boolean }> {
  await apiPut(`/api/attendance-sessions/${sessionId}`, {
    endTime: new Date().toISOString(),
  });
  return { success: true };
}

const STATUS_TO_BE: Record<AttendanceRecord['status'], string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

/** POST /api/attendance-records — Lecturer/SchoolAdmin/SuperAdmin tự điểm danh tay cho 1 sinh viên
 *  (vd sinh viên bị bỏ sót khi điểm danh bằng AI trên app di động). */
export async function createAttendanceRecord(
  sessionId: string,
  studentId: string,
  status: AttendanceRecord['status'],
): Promise<AttendanceRecord> {
  const record = await apiPost<ApiAttendanceRecord>('/api/attendance-records', {
    sessionId,
    studentId,
    status: STATUS_TO_BE[status],
    method: 'Manual',
  });
  return mapApiAttendanceRecord(record);
}

/** GET /api/attendance-sessions — danh sách tất cả sessions */
export async function fetchAttendanceSessions(
  params: ListQueryParams = {},
): Promise<PagedResult<ApiAttendanceSession>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const { data, pagination } = await apiGetPaginated<ApiAttendanceSession[]>(
    `/api/attendance-sessions${buildQueryParams({ page, pageSize, expand: 'class' })}`,
  );
  return { items: data, pagination };
}

async function buildAttendanceSession(session: ApiAttendanceSession): Promise<AttendanceSession> {
  const cls = session.class
    ? mapApiClassToLecturerClass(session.class as never)
    : null;

  let records: AttendanceRecord[] = [];
  try {
    // expand=student — không gửi thì record.student luôn null, tên hiện "Unknown" dù có data thật.
    const recRes = await apiGetPaginated<ApiAttendanceRecord[]>(
      `/api/attendance-records${buildQueryParams({ page: 1, pageSize: 200, expand: 'student' })}`,
    );
    records = recRes.data
      .filter((r) => r.sessionId === session.id)
      .map(mapApiAttendanceRecord);
  } catch {
    records = [];
  }

  const presentCount = records.filter((r) => r.status === 'present' || r.status === 'late').length;

  return {
    id: session.id,
    classId: session.classId,
    classCode: cls?.code ?? session.classId.slice(0, 8),
    className: cls?.name ?? 'Unknown',
    room: cls?.room ?? '—',
    startTime: new Date(session.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    endTime: session.endTime
      ? new Date(session.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '—',
    isActive: !session.endTime,
    totalStudents: records.length,
    presentCount,
    absentCount: records.length - presentCount,
    records,
  };
}

/** POST /api/attendance-sessions/{sessionId}/records/bulk — điểm danh thủ công.
 *  BE nhận { presentStudentIds, method, status } — group records by status rồi gửi từng batch. */
export async function bulkUpdateAttendance(
  sessionId: string,
  records: Array<{ studentId: string; status: string }>,
): Promise<void> {
  // Group student IDs by status (Present, Absent, Late, Excused…)
  const byStatus = records.reduce<Record<string, string[]>>((acc, r) => {
    const key = r.status.charAt(0).toUpperCase() + r.status.slice(1).toLowerCase();
    (acc[key] ??= []).push(r.studentId);
    return acc;
  }, {});

  await Promise.all(
    Object.entries(byStatus).map(([status, studentIds]) =>
      apiPost(`/api/attendance-sessions/${sessionId}/records/bulk`, {
        presentStudentIds: studentIds,
        method: 'Manual',
        status,
      }),
    ),
  );
}

// ─── Violation Logs ───────────────────────────────────────────────────────

/** GET /api/violation-logs — raw paginated (giữ đủ evidencePath cho review page) */
export async function fetchViolationLogs(
  params: ListQueryParams = {},
): Promise<PagedResult<ApiViolationLog>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const { data, pagination } = await apiGetPaginated<ApiViolationLog[]>(
    `/api/violation-logs${buildQueryParams({ page, pageSize })}`,
  );
  return { items: data, pagination };
}

/** GET /api/violation-logs/{id} */
export async function fetchViolationById(id: string): Promise<ApiViolationLog> {
  return apiGet<ApiViolationLog>(`/api/violation-logs/${id}`);
}

/** GET /api/exam-slots/{id} — lấy tên bài thi */
export async function fetchExamSlotById(id: string): Promise<import('../types/api').ApiExamSlot | null> {
  try {
    return await apiGet<import('../types/api').ApiExamSlot>(`/api/exam-slots/${id}`);
  } catch {
    return null;
  }
}

/** GET /api/violation-logs/exam-slot/{examSlotId} — violation logs theo bài thi */
export async function fetchViolationsByExamSlot(
  examSlotId: string,
  params: ListQueryParams = {},
): Promise<PagedResult<ApiViolationLog>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const { data, pagination } = await apiGetPaginated<ApiViolationLog[]>(
    `/api/violation-logs/exam-slot/${examSlotId}${buildQueryParams({ page, pageSize })}`,
  );
  return { items: data, pagination };
}

/** PUT /api/violation-logs/{id} — đánh dấu đã review */
export async function reviewViolationLog(id: string, reviewedBy: string): Promise<void> {
  await apiPut(`/api/violation-logs/${id}`, { isReviewed: true, reviewedBy });
}

const EXAM_EVIDENCE_BUCKET = 'exam-evidence';

/**
 * POST /api/storage/signed-url — `evidencePath` trả về từ `/api/violation-logs` chỉ là raw object
 * path trong bucket Supabase (BE không tự sign khi trả list), KHÔNG phải URL xem/tải được trực
 * tiếp. Phải đổi qua endpoint này lấy signed URL thật rồi mới fetch/phát video hay hiển thị ảnh.
 */
export async function resolveEvidenceUrl(path: string): Promise<string> {
  const result = await apiPost<{ signedUrl: string }>(
    `/api/storage/signed-url${buildQueryParams({ bucket: EXAM_EVIDENCE_BUCKET, path })}`,
  );
  return result.signedUrl;
}

/** GET /api/exam-participations/{id} — lấy thông tin participation + student */
export async function fetchParticipationById(id: string): Promise<ApiExamParticipation | null> {
  try {
    const participation = await apiGet<ApiExamParticipation>(`/api/exam-participations/${id}`);
    // Nếu student null nhưng có studentId, fetch user riêng
    if (participation && !participation.student && participation.studentId) {
      try {
        const user = await apiGet<import('../types/api').ApiUser>(`/api/users/${participation.studentId}`);
        return { ...participation, student: user };
      } catch {
        return participation;
      }
    }
    return participation;
  } catch {
    return null;
  }
}

export { updateParticipationStatus, disqualifyParticipation };

// ─── Unused exports giữ lại để không break imports ────────────────────────

export async function fetchLecturerClasses(): Promise<LecturerClass[]> {
  const { items } = await fetchSchoolAdminClasses({ page: 1, pageSize: 50 });
  return items;
}

export { fetchExamSlots as fetchLecturerExams };
