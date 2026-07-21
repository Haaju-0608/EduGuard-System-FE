/** Trạng thái lớp học */
export type ClassStatus = 'active' | 'completed' | 'upcoming';

/** Trạng thái sinh viên */
export type StudentStatus = 'active' | 'inactive' | 'pending';

/** Trạng thái điểm danh trong phiên */
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

/** Trạng thái duyệt sinh trắc học */
export type BiometricStatus = 'pending' | 'approved' | 'rejected';

/** Mức độ cảnh báo vi phạm */
export type ViolationSeverity = 'low' | 'medium' | 'high';

/** Mã khoa / ngành */
export type FacultyId = 'it' | 'economics' | 'business' | 'engineering' | 'foreign-lang';

/** Thông tin lớp học của giảng viên */
export interface LecturerClass {
  id: string;
  code: string;
  name: string;
  facultyId: FacultyId;
  semester: string;
  schedule: string;
  room: string;
  studentCount: number;
  status: ClassStatus;
  attendanceRate: number;
  lecturerId: string;
  lecturerName: string;
}

/** Thông tin sinh viên thuộc lớp giảng viên */
export interface LecturerStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  classId: string;
  classCode: string;
  className: string;
  facultyId: FacultyId;
  status: StudentStatus;
  attendanceRate: number;
  avatar: string | null;
  initials: string;
}

/** Sinh viên trong phiên điểm danh */
export interface AttendanceRecord {
  id: string;
  studentId: string;
  name: string;
  classCode: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  avatar: string | null;
  initials: string;
}

/** Phiên điểm danh đang mở */
export interface AttendanceSession {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  room: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  records: AttendanceRecord[];
}

/** Yêu cầu duyệt ảnh sinh trắc học */
export interface BiometricRequest {
  id: string;
  studentId: string;
  studentName: string;
  classCode: string;
  submittedAt: string;
  photoUrl: string;
  faceImagePath: string | null;
  status: BiometricStatus;
  note?: string;
}

/** Cảnh báo vi phạm trong phiên thi/giám sát */
export interface ViolationAlert {
  id: string;
  studentId: string;
  studentName: string;
  classCode: string;
  type: string;
  severity: ViolationSeverity;
  timestamp: string;
  description: string;
}

/** KPI tổng quan dashboard giảng viên */
export interface LecturerKpi {
  label: string;
  value: string;
  icon: string;
  colorClass: string;
  bgGlow: string;
  change: string | null;
  changeColor?: string;
}

/** Ca thi từ GET /api/exam-slots */
export type ExamSlotStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface ExamSlot {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  examName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: ExamSlotStatus;
  proctorId?: string;
}
