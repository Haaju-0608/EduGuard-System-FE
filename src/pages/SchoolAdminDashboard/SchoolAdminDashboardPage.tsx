import { Routes, Route } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import SchoolDashboardOverview from './sections/SchoolDashboardOverview';
import SchoolStudentManagementPage from './sections/SchoolStudentManagementPage';
import LecturerManagementPage from './sections/LecturerManagementPage';
import SchoolClassManagementPage from './sections/SchoolClassManagementPage';
import BiometricApprovalPage from './sections/BiometricApprovalPage';
import WalletPage from './sections/WalletPage';
import WalletPaymentResultPage from './sections/WalletPaymentResultPage';
import ExamManagementPage from './sections/ExamManagementPage';
import ExamQuestionsPage from './sections/ExamQuestionsPage';
import ProfileDetailPage from '../UserProfile/sections/ProfileDetailPage';

const menuItems: MenuItem[] = [
  { icon: '🏫', label: 'Dashboard',    path: '/school' },
  { icon: '👨‍🎓', label: 'Students',     path: '/school/students' },
  { icon: '👨‍🏫', label: 'Lecturers',    path: '/school/lecturers' },
  { icon: '📚', label: 'Classes',      path: '/school/classes' },
  { icon: '📝', label: 'Exams',        path: '/school/exams' },
  { icon: '💳', label: 'Wallet',       path: '/school/wallet' },
  { icon: '🔐', label: 'Face Approval', path: '/school/biometric' },
  { icon: '👤', label: 'My Profile',   path: '/school/profile' },
];

export default function SchoolAdminDashboardPage() {
  return (
    <DashboardLayout menuItems={menuItems}>
      <div className="max-w-7xl mx-auto w-full animate-fade-slide-in">
        <Routes>
          <Route index element={<SchoolDashboardOverview />} />
          <Route path="students" element={<SchoolStudentManagementPage />} />
          <Route path="lecturers" element={<LecturerManagementPage />} />
          <Route path="classes" element={<SchoolClassManagementPage />} />
          <Route path="exams" element={<ExamManagementPage />} />
          <Route path="exams/:examId/questions" element={<ExamQuestionsPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="wallet-result" element={<WalletPaymentResultPage />} />
          <Route path="biometric" element={<BiometricApprovalPage />} />
          <Route path="profile" element={<ProfileDetailPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
