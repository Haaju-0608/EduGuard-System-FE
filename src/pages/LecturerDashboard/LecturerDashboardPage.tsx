import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import DashboardOverview from './sections/DashboardOverview';
import ClassManagementPage from './sections/ClassManagementPage';
import AttendanceSessionPage from './sections/AttendanceSessionPage';
import ExamSlotsPage from './sections/ExamSlotsPage';
import ExamQuestionsViewPage from './sections/ExamQuestionsViewPage';
import EssayGradingPage from './sections/EssayGradingPage';
import ViolationReviewPage from './sections/ViolationReviewPage';
import LecturerGuidePage from './sections/LecturerGuidePage';
import LecturerNotFoundPage from './sections/NotFoundPage';
import ProfileDetailPage from '../UserProfile/sections/ProfileDetailPage';

/** Menu sidebar cho role giảng viên */
const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/lecture' },
  { icon: '📚', label: 'Exam Classes', path: '/lecture/classes' },
  { icon: '📋', label: 'Attendance', path: '/lecture/attendance' },
  { icon: '📝', label: 'Exams', path: '/lecture/exams' },
  { icon: '🚨', label: 'Violations', path: '/lecture/violations' },
  { icon: '📖', label: 'Proctoring Guide', path: '/lecture/guide' },
  { icon: '👤', label: 'My Profile', path: '/lecture/profile' },
];

/** Layout chính dashboard giảng viên */
export default function LecturerDashboardPage() {
  return (
    <DashboardLayout menuItems={menuItems} campusMode>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="classes" element={<ClassManagementPage />} />
        <Route path="attendance" element={<AttendanceSessionPage />} />
        <Route path="exams" element={<ExamSlotsPage />} />
        <Route path="exams/:examId/questions" element={<ExamQuestionsViewPage />} />
        <Route path="exams/:examId/grading" element={<EssayGradingPage />} />
        <Route path="violations" element={<ViolationReviewPage />} />
        <Route path="guide" element={<LecturerGuidePage />} />
        <Route path="profile" element={<ProfileDetailPage />} />
        <Route path="*" element={<LecturerNotFoundPage />} />
      </Routes>
    </DashboardLayout>
  );
}
