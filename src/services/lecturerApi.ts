/**
 * API giả cho module Giảng viên (Lecturer).
 * Khi ráp backend: thay mockApiResponse bằng apiGet/apiPost/... từ apiClient.
 *
 * @example
 * return apiGet<LecturerClass[]>('/api/lecturer/classes');
 * return apiPost<AttendanceSession>('/api/attendance/sessions', { classId });
 */
import { mockApiResponse } from './apiClient';
import {
  MOCK_ATTENDANCE_SESSION,
  MOCK_BIOMETRIC_REQUESTS,
  MOCK_CAMERA_FEEDS,
  MOCK_LECTURER_CLASSES,
  MOCK_LECTURER_KPIS,
  MOCK_LECTURER_STUDENTS,
  MOCK_VIOLATION_ALERTS,
} from './mockData/lecturerMockData';
import type {
  AttendanceSession,
  BiometricRequest,
  BiometricStatus,
  CameraFeed,
  LecturerClass,
  LecturerKpi,
  LecturerStudent,
  ViolationAlert,
} from '../types/lecturer';

/** Lấy danh sách KPI tổng quan dashboard giảng viên */
export async function fetchLecturerKpis(): Promise<LecturerKpi[]> {
  return mockApiResponse([...MOCK_LECTURER_KPIS]);
}

/** Lấy danh sách lớp học của giảng viên đang đăng nhập */
export async function fetchLecturerClasses(): Promise<LecturerClass[]> {
  return mockApiResponse([...MOCK_LECTURER_CLASSES]);
}

/** Lấy chi tiết một lớp học theo ID */
export async function fetchClassById(classId: string): Promise<LecturerClass | null> {
  const found = MOCK_LECTURER_CLASSES.find((c) => c.id === classId) ?? null;
  return mockApiResponse(found);
}

/** Lấy danh sách sinh viên — có thể lọc theo classId */
export async function fetchLecturerStudents(classId?: string): Promise<LecturerStudent[]> {
  const students = classId
    ? MOCK_LECTURER_STUDENTS.filter((s) => s.classId === classId)
    : [...MOCK_LECTURER_STUDENTS];
  return mockApiResponse(students);
}

/** Lấy chi tiết sinh viên theo ID (bao gồm thông tin lớp học) */
export async function fetchStudentById(studentId: string): Promise<LecturerStudent | null> {
  const found = MOCK_LECTURER_STUDENTS.find((s) => s.id === studentId) ?? null;
  return mockApiResponse(found);
}

/** Lấy phiên điểm danh đang mở — truyền classId để lọc (tùy chọn) */
export async function fetchActiveAttendanceSession(classId?: string): Promise<AttendanceSession | null> {
  const session = classId && MOCK_ATTENDANCE_SESSION.classId !== classId
    ? null
    : { ...MOCK_ATTENDANCE_SESSION, records: [...MOCK_ATTENDANCE_SESSION.records] };
  return mockApiResponse(session);
}

/** Mở phiên điểm danh mới cho một lớp */
export async function startAttendanceSession(classId: string): Promise<AttendanceSession> {
  const cls = MOCK_LECTURER_CLASSES.find((c) => c.id === classId);
  const students = MOCK_LECTURER_STUDENTS.filter((s) => s.classId === classId);

  const session: AttendanceSession = {
    id: `att-${Date.now()}`,
    classId,
    classCode: cls?.code ?? 'N/A',
    className: cls?.name ?? 'Unknown',
    room: cls?.room ?? 'N/A',
    startTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    endTime: '—',
    isActive: true,
    totalStudents: students.length,
    presentCount: 0,
    absentCount: students.length,
    records: students.map((s) => ({
      id: `r-${s.id}`,
      studentId: s.studentId,
      name: s.name,
      classCode: s.classCode,
      status: 'absent' as const,
      checkInTime: null,
      avatar: s.avatar,
      initials: s.initials,
    })),
  };

  return mockApiResponse(session, 600);
}

/** Đóng phiên điểm danh hiện tại */
export async function endAttendanceSession(sessionId: string): Promise<{ success: boolean }> {
  void sessionId;
  return mockApiResponse({ success: true }, 500);
}

/** Lấy danh sách yêu cầu duyệt sinh trắc học */
export async function fetchBiometricRequests(status?: BiometricStatus): Promise<BiometricRequest[]> {
  const requests = status
    ? MOCK_BIOMETRIC_REQUESTS.filter((r) => r.status === status)
    : [...MOCK_BIOMETRIC_REQUESTS];
  return mockApiResponse(requests);
}

/** Duyệt hoặc từ chối ảnh sinh trắc học của sinh viên */
export async function reviewBiometricRequest(
  requestId: string,
  status: 'approved' | 'rejected',
  note?: string
): Promise<BiometricRequest> {
  const request = MOCK_BIOMETRIC_REQUESTS.find((r) => r.id === requestId);
  if (!request) throw new Error('Request not found');

  const updated: BiometricRequest = { ...request, status, note };
  return mockApiResponse(updated, 500);
}

/** Lấy danh sách camera feed cho dashboard giám sát */
export async function fetchCameraFeeds(): Promise<CameraFeed[]> {
  return mockApiResponse([...MOCK_CAMERA_FEEDS]);
}

/** Lấy danh sách cảnh báo vi phạm */
export async function fetchViolationAlerts(): Promise<ViolationAlert[]> {
  return mockApiResponse([...MOCK_VIOLATION_ALERTS]);
}
