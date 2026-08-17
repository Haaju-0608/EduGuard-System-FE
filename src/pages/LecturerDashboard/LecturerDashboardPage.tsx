import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import DashboardOverview from './sections/DashboardOverview';
import ClassManagementPage from './sections/ClassManagementPage';
import ClassStudentsPage from './sections/ClassStudentsPage';
import StudentExamHistoryPage from './sections/StudentExamHistoryPage';
import AttendanceClassesPage from './sections/AttendanceClassesPage';
import AttendanceExamsPage from './sections/AttendanceExamsPage';
import AttendanceRosterPage from './sections/AttendanceRosterPage';
import ExamClassesPage from './sections/ExamClassesPage';
import ExamSlotsPage from './sections/ExamSlotsPage';
import ExamQuestionsViewPage from './sections/ExamQuestionsViewPage';
import LiveMonitoringPage from './sections/LiveMonitoringPage';
import ViolationReviewPage from './sections/ViolationReviewPage';
import LecturerNotFoundPage from './sections/NotFoundPage';
import ProfileDetailPage from '../UserProfile/sections/ProfileDetailPage';

/** Menu sidebar cho role giảng viên */
const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/lecture' },
  { icon: '📚', label: 'Exam Classes', path: '/lecture/classes' },
  { icon: '📋', label: 'Attendance', path: '/lecture/attendance' },
  { icon: '📝', label: 'Exams', path: '/lecture/exams' },
  { icon: '📡', label: 'Live Monitoring', path: '/lecture/live-monitoring' },
  { icon: '🚨', label: 'Violations', path: '/lecture/violations' },
  { icon: '👤', label: 'My Profile', path: '/lecture/profile' },
];

/** Layout chính dashboard giảng viên */
export default function LecturerDashboardPage() {
  return (
    <DashboardLayout menuItems={menuItems} campusMode>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="classes" element={<ClassManagementPage />} />
        <Route path="classes/:classId" element={<ClassStudentsPage />} />
        <Route path="classes/:classId/students/:studentId" element={<StudentExamHistoryPage />} />
        <Route path="attendance" element={<AttendanceClassesPage />} />
        <Route path="attendance/:classId" element={<AttendanceExamsPage />} />
        <Route path="attendance/:classId/:examId" element={<AttendanceRosterPage />} />
        <Route path="exams" element={<ExamClassesPage />} />
        <Route path="exams/:classId" element={<ExamSlotsPage />} />
        <Route path="exams/:examId/questions" element={<ExamQuestionsViewPage />} />
        <Route path="live-monitoring" element={<LiveMonitoringPage />} />
        <Route path="violations" element={<ViolationReviewPage />} />
        <Route path="profile" element={<ProfileDetailPage />} />
        <Route path="*" element={<LecturerNotFoundPage />} />
      </Routes>
    </DashboardLayout>
  );
}
