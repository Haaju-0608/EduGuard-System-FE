/**
 * API Lecturer — attendance sessions, violation logs, exam participations.
 */
import { apiGet, apiGetAllPages, apiGetPaginated, apiPost, apiPut, buildQueryParams } from './apiClient';
import { updateParticipationStatus, disqualifyParticipation, voidExamParticipation } from './schoolAdminApi';
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
export async function fetchLecturerKpis(proctorId?: string): Promise<LecturerKpi[]> {
  try {
    const [classRes, examRes] = await Promise.all([
      fetchSchoolAdminClasses({ page: 1, pageSize: 50 }),
      fetchExamSlots({ page: 1, pageSize: 50 }),
    ]);

    const activeClasses = classRes.items.filter((c) => c.status === 'active').length;
    // BE /api/exam-slots chưa scope theo proctor — trả về TOÀN BỘ exam slot hệ thống, phải tự lọc.
    const myExams = examRes.items.filter((e) => !proctorId || e.proctorId === proctorId);
    const ongoingExams = myExams.filter((e) => e.status === 'ongoing').length;
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
  // classId gửi thẳng lên BE (GetAll đã hỗ trợ filter theo classId) thay vì tải 50 session đầu
  // của toàn hệ thống rồi filter client-side — tránh bị rớt session thật nếu hệ thống có nhiều
  // session hơn 50 (giống bug pagination đã gặp ở attendance-records).
  // expand=class — BE chỉ populate session.class khi có tham số này (Helpers/AcademicMapper.cs),
  // không gửi thì className luôn rơi về "Unknown" dù data thật vẫn tồn tại.
  const { data } = await apiGetPaginated<ApiAttendanceSession[]>(
    `/api/attendance-sessions${buildQueryParams({ page: 1, pageSize: 50, expand: 'class', classId })}`,
  );

  // Nếu có nhiều hơn 1 session đang mở cho cùng lớp (vd quên bấm End Session ở lần test trước),
  // ưu tiên session mới nhất — tránh vô tình bám vào 1 session cũ đã "mồ côi".
  const active = data
    .filter((s) =>
      s.status?.toLowerCase() !== 'closed' &&
      s.status?.toLowerCase() !== 'completed' &&
      s.endTime == null,
    )
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

  if (!active) return null;
  return buildAttendanceSession(active);
}

/** GET /api/attendance-sessions/{id} — lấy lại đúng 1 session theo ID, dùng để refresh sau khi
 *  điểm danh tay thay vì "active session theo classId" (mơ hồ nếu có nhiều session cùng mở). */
export async function fetchAttendanceSessionById(id: string): Promise<AttendanceSession | null> {
  try {
    const found = await apiGet<ApiAttendanceSession>(
      `/api/attendance-sessions/${id}${buildQueryParams({ expand: 'class' })}`,
    );
    return buildAttendanceSession(found);
  } catch {
    return null;
  }
}

export interface OpenSessionSummary {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  examSlotId: string | null;
  examName: string | null;
  examEndTime: string | null;
  startTime: string;
}

/** GET /api/attendance-sessions — toàn bộ session lecturer này ĐƯỢC PHÉP đóng (không phụ thuộc ca
 *  thi đã hết giờ hay chưa — hệ thống không tự đóng session theo giờ). Dùng cho màn hình dọn dẹp
 *  "Open Sessions", tránh mỗi lần chỉ thấy được 1 session "mới nhất" như fetchActiveAttendanceSession().
 *  Không gọi buildAttendanceSession (tốn thêm 2 request/session cho records+examSlot) vì màn hình
 *  dọn dẹp chỉ cần thông tin tóm tắt để hiển thị + đóng.
 *
 *  Lọc theo QUYỀN QUẢN LÝ (chủ lớp HOẶC proctor của exam slot) — khớp đúng EnsureSessionAccessAsync
 *  ở BE — KHÔNG lọc theo "session do chính mình tạo" (createdBy): 1 session có thể do người khác mở
 *  (SchoolAdmin test, lecturer khác...) nhưng lecturer sở hữu/coi thi lớp đó vẫn được BE cho phép
 *  đóng lại. Lọc theo createdBy sẽ bỏ sót các session "kẹt" InProgress do người khác mở, khiến
 *  không ai đóng lại được, làm class bị chặn mở session mới vĩnh viễn. */
export async function fetchMyOpenAttendanceSessions(userId: string): Promise<OpenSessionSummary[]> {
  const data = await apiGetAllPages<ApiAttendanceSession>(
    (page, pageSize) => `/api/attendance-sessions${buildQueryParams({ page, pageSize, expand: 'class' })}`,
  );
  // Lọc theo status thay vì chỉ endTime==null: endAttendanceSession trước đây (đã fix) không gửi
  // status khi đóng session, khiến BE luôn set nhầm Status=InProgress dù EndTime đã có giá trị —
  // để lại các session "kẹt" InProgress vĩnh viễn trong DB (dữ liệu cũ, fix chỉ chặn phát sinh
  // thêm chứ không tự sửa các bản ghi cũ).
  const openish = data.filter((s) =>
    s.status?.toLowerCase() !== 'completed' && s.status?.toLowerCase() !== 'cancelled',
  );
  if (openish.length === 0) return [];

  // Batch resolve tên + giờ kết thúc bài thi + proctor cho những session có examSlotId — tránh N+1
  // request rời rạc, và cần dữ liệu này ngay để lọc theo quyền quản lý bên dưới.
  const examSlotIds = [...new Set(openish.map((s) => s.examSlotId).filter((id): id is string => !!id))];
  const examSlots = await Promise.all(examSlotIds.map((id) => fetchExamSlotById(id)));
  const examById = new Map(
    examSlots.filter((e): e is NonNullable<typeof e> => !!e).map((e) => [e.id, e]),
  );

  const mine = openish.filter((s) => {
    if (s.createdBy === userId) return true;
    if (s.class?.lecturerId === userId) return true;
    const exam = s.examSlotId ? examById.get(s.examSlotId) : null;
    return exam?.proctor?.id === userId;
  });
  if (mine.length === 0) return [];

  return mine
    .map((s) => {
      const cls = s.class ? mapApiClassToLecturerClass(s.class as never) : null;
      const exam = s.examSlotId ? examById.get(s.examSlotId) : null;
      return {
        id: s.id,
        classId: s.classId,
        classCode: cls?.code ?? s.classId.slice(0, 8),
        className: cls?.name ?? 'Unknown',
        examSlotId: s.examSlotId,
        examName: exam?.examName ?? null,
        examEndTime: exam?.endTime ?? null,
        startTime: s.startTime,
      };
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}

/** POST /api/attendance-sessions — bắt đầu phiên điểm danh mới, gắn kèm examSlotId nếu điểm danh
 *  này là cho 1 bài thi cụ thể (BE validate examSlot.ClassId phải khớp classId truyền lên). */
export async function startAttendanceSession(classId: string, examSlotId?: string): Promise<AttendanceSession> {
  const created = await apiPost<ApiAttendanceSession>('/api/attendance-sessions', {
    classId,
    startTime: new Date().toISOString(),
    ...(examSlotId ? { examSlotId } : {}),
  });
  return buildAttendanceSession(created);
}

/** PUT /api/attendance-sessions/{id} — đóng phiên điểm danh.
 *  status BẮT BUỘC phải gửi "Completed": UpdateAttendanceSessionDto.Status là enum non-nullable,
 *  không gửi thì BE deserialize thành default = InProgress (member đầu tiên) — session coi như
 *  "đóng" (có endTime) nhưng Status vẫn kẹt ở InProgress mãi mãi. BE (08/08) vừa thêm check chặn mở
 *  session mới nếu lớp đang có session Status=InProgress — nếu không gửi đúng status này, sẽ không
 *  bao giờ mở lại được session cho lớp đó nữa vì session cũ "tưởng" vẫn đang InProgress.
 *  endTime — cho phép truyền tay (mặc định "now"): BE (08/08) giờ chặn EndTime > ExamSlot.EndTime
 *  cho session gắn examSlotId, nên khi đóng session vì bài thi đã hết giờ từ lâu (auto-close), phải
 *  gửi đúng giờ kết thúc bài thi thay vì "now" thật — nếu không sẽ luôn bị 400. */
export async function endAttendanceSession(
  sessionId: string,
  endTime?: string,
): Promise<{ success: boolean }> {
  await apiPut(`/api/attendance-sessions/${sessionId}`, {
    endTime: endTime ?? new Date().toISOString(),
    status: 'Completed',
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

/** PUT /api/attendance-records/{id} — sửa lại trạng thái 1 record đã điểm danh (lecturer đánh nhầm
 *  Present/Absent). BE chặn duy nhất trường hợp session đã Cancelled, còn lại (kể cả sau khi session
 *  đã Completed) vẫn sửa được — không cần session đang mở. */
export async function updateAttendanceRecord(
  recordId: string,
  status: AttendanceRecord['status'],
): Promise<void> {
  await apiPut(`/api/attendance-records/${recordId}`, {
    status: STATUS_TO_BE[status],
    method: 'Manual',
  });
}

/** POST /api/attendance-sessions/{sessionId}/records/ai-video — điểm danh hàng loạt bằng AI quét
 *  video lớp học (AttendanceRecordsController.CreateBulkByAiVideo, DTOs/Request/AcademicRequestDtos.cs
 *  AiVideoAttendanceDto). BE upload video lên Supabase qua FastAPI, tách vector khuôn mặt từng người
 *  trong video, so khớp với BiometricData.FaceVector đã duyệt (ngưỡng 0.40) để tự đánh Present cho
 *  từng sinh viên nhận diện được.
 *
 *  BE (commit f62273e, 09/08) đã sửa: session KHÔNG còn tự đóng (Status vẫn giữ InProgress) sau khi
 *  quét xong nữa — chỉ đơn thuần "thêm record" như điểm danh tay, session vẫn mở để giảng viên tự
 *  kiểm tra + điểm danh bù thủ công rồi mới tự bấm "End Session" khi xong. Chỉ gọi được khi session
 *  đang InProgress và trong khung giờ [StartTime, EndTime] của session (BE tự chặn 400 nếu sai
 *  điều kiện). */
export async function markAttendanceByAiVideo(
  sessionId: string,
  videoFile: File,
): Promise<AttendanceRecord[]> {
  const formData = new FormData();
  formData.append('videoFile', videoFile);
  const records = await apiPost<ApiAttendanceRecord[]>(
    `/api/attendance-sessions/${sessionId}/records/ai-video`,
    formData,
  );
  return records.map(mapApiAttendanceRecord);
}

/** GET /api/attendance-sessions — danh sách tất cả sessions */
export async function fetchAttendanceSessions(
  params: ListQueryParams = {},
): Promise<PagedResult<ApiAttendanceSession>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  // pageSize>100 bị BE từ chối (400) — gộp nhiều trang 100 nếu caller xin nhiều hơn. Quan trọng cho
  // trang Monitoring (SchoolAdmin): phải thấy được HẾT session trong institution để tìm ra session
  // "kẹt" InProgress cần đóng tay, bỏ sót do phân trang sẽ khiến không tìm được nó.
  if (pageSize > 100) {
    const data = await apiGetAllPages<ApiAttendanceSession>(
      (p, ps) => `/api/attendance-sessions${buildQueryParams({ page: p, pageSize: ps, expand: 'class' })}`,
    );
    return { items: data, pagination: { page: 1, pageSize: data.length || 1, totalItems: data.length, totalPages: 1 } };
  }
  const { data, pagination } = await apiGetPaginated<ApiAttendanceSession[]>(
    `/api/attendance-sessions${buildQueryParams({ page, pageSize, expand: 'class' })}`,
  );
  return { items: data, pagination };
}

/** GET /api/attendance-sessions + /api/attendance-records — gộp record của TẤT CẢ session từng mở
 *  cho 1 bài thi cụ thể trong 1 lớp (không chỉ session "đang active"). Dùng cho trang xem trạng thái
 *  điểm danh theo bài thi (roster luôn xem được, kể cả sau khi session đã đóng) — khác
 *  buildAttendanceSession() vốn chỉ tra được 1 session cụ thể. Nếu 1 bài thi có nhiều session (vd mở
 *  lại sau khi đóng sớm để bù người), session mở sau (startTime lớn hơn) ghi đè record của session
 *  mở trước cho cùng 1 sinh viên.
 */
export async function fetchAttendanceRecordsByExam(
  classId: string,
  examSlotId: string,
): Promise<AttendanceRecord[]> {
  const sessions = await apiGetAllPages<ApiAttendanceSession>(
    (page, pageSize) => `/api/attendance-sessions${buildQueryParams({ page, pageSize, classId })}`,
  );
  const examSessions = sessions
    .filter((s) => s.examSlotId === examSlotId)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  if (examSessions.length === 0) return [];

  const recordLists = await Promise.all(
    examSessions.map((s) =>
      apiGetAllPages<ApiAttendanceRecord>(
        (page, pageSize) => `/api/attendance-records${buildQueryParams({ page, pageSize, sessionId: s.id, expand: 'student' })}`,
      ),
    ),
  );

  const byStudent = new Map<string, AttendanceRecord>();
  for (const list of recordLists) {
    for (const raw of list) {
      byStudent.set(raw.studentId, mapApiAttendanceRecord(raw));
    }
  }
  return [...byStudent.values()];
}

async function buildAttendanceSession(session: ApiAttendanceSession): Promise<AttendanceSession> {
  const cls = session.class
    ? mapApiClassToLecturerClass(session.class as never)
    : null;

  let records: AttendanceRecord[] = [];
  try {
    // sessionId — BẮT BUỘC phải lọc tại BE, không lọc client-side bằng cách fetch nhiều record
    // đầu tiên của TOÀN HỆ THỐNG rồi filter theo sessionId: nếu tổng số attendance-records toàn
    // hệ thống (mọi lớp, mọi session, từ trước tới giờ) vượt quá 1 trang, record của session hiện
    // tại dễ bị rơi khỏi trang 1 và biến mất khỏi UI — dù record đó có thật trong DB (BE vẫn báo
    // "already exists" khi cố tạo lại), gây hiện tượng "0 total students" sai lệch trên UI.
    // pageSize>100 bị BE từ chối thẳng (400) — dùng apiGetAllPages để gộp nhiều trang 100 thay vì
    // 1 trang lớn.
    // expand=student — không gửi thì record.student luôn null, tên hiện "Unknown" dù có data thật.
    const apiRecords = await apiGetAllPages<ApiAttendanceRecord>(
      (page, pageSize) => `/api/attendance-records${buildQueryParams({ page, pageSize, sessionId: session.id, expand: 'student' })}`,
    );
    records = apiRecords.map(mapApiAttendanceRecord);
  } catch {
    records = [];
  }

  const presentCount = records.filter((r) => r.status === 'present' || r.status === 'late').length;

  // Session được tạo với examSlotId → tra thẳng ra tên bài thi, không cần đoán theo giờ overlap.
  const examSlot = session.examSlotId ? await fetchExamSlotById(session.examSlotId) : null;

  return {
    id: session.id,
    classId: session.classId,
    classCode: cls?.code ?? session.classId.slice(0, 8),
    className: cls?.name ?? 'Unknown',
    examSlotId: session.examSlotId,
    examName: examSlot?.examName ?? null,
    examEndTime: examSlot?.endTime ?? null,
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
  // pageSize>100 bị BE từ chối (400) — gộp nhiều trang 100 nếu caller xin nhiều hơn (vd trang
  // Violation Review tải LOG_FETCH_SIZE=500 một lần để tự nhóm/phân trang lại theo card ở FE).
  if (pageSize > 100) {
    const data = await apiGetAllPages<ApiViolationLog>(
      (p, ps) => `/api/violation-logs${buildQueryParams({ page: p, pageSize: ps })}`,
    );
    return { items: data, pagination: { page: 1, pageSize: data.length || 1, totalItems: data.length, totalPages: 1 } };
  }
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

export { updateParticipationStatus, disqualifyParticipation, voidExamParticipation };

// ─── Unused exports giữ lại để không break imports ────────────────────────

export async function fetchLecturerClasses(): Promise<LecturerClass[]> {
  const { items } = await fetchSchoolAdminClasses({ page: 1, pageSize: 50 });
  return items;
}

export { fetchExamSlots as fetchLecturerExams };
