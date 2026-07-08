import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import DashboardOverview from './sections/DashboardOverview';
import UserManagementPage from './sections/UserManagementPage';
import ReportsPage from './sections/ReportsPage';
import CreditsPage from './sections/CreditsPage';
import SettingsPage from './sections/SettingsPage';
import InstitutionsPage from './sections/InstitutionsPage';
import PricingPlansPage from './sections/PricingPlansPage';

const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/admin' },
  { icon: '🏫', label: 'Institutions', path: '/admin/institutions' },
  { icon: '👥', label: 'Users', path: '/admin/users' },
  { icon: '💰', label: 'Pricing Plans', path: '/admin/pricing' },
  { icon: '💳', label: 'Credits', path: '/admin/credits' },
  { icon: '📊', label: 'Reports', path: '/admin/reports' },
  { icon: '⚙️', label: 'Settings', path: '/admin/settings' },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout menuItems={menuItems}>
      <div className="max-w-350 mx-auto animate-fade-slide-in">
        <Routes>
          <Route index element={<DashboardOverview onNavigate={navigate} />} />
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="pricing" element={<PricingPlansPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
