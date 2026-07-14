import { useAuth } from '../contexts/AuthContext';
import type { FacultyId } from '../types/lecturer';
import { getFacultyByDepartment, getFacultyTheme } from '../utils/facultyTheme';

/** Lấy khoa của giảng viên đang đăng nhập */
export function useLecturerFaculty() {
  const { user } = useAuth();
  const facultyId: FacultyId = user?.department
    ? getFacultyByDepartment(user.department)
    : 'it';
  const faculty = getFacultyTheme(facultyId);
  const lastName = user?.name?.split(' ').slice(-1)[0] ?? 'Instructor';

  return { facultyId, faculty, lastName, user };
}
