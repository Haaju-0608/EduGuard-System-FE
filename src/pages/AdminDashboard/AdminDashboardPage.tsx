import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import DashboardOverview from './sections/DashboardOverview';
import UserManagementPage from './sections/UserManagementPage';
import ReportsPage from './sections/ReportsPage';
import CreditsPage from './sections/CreditsPage';
import PricingPlansPage from './sections/PricingPlansPage';
import InstitutionsPage from './sections/InstitutionsPage';
import ContactRequestsPage from './sections/ContactRequestsPage';

const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/admin' },
  { icon: '🏫', label: 'Institutions', path: '/admin/institutions' },
  { icon: '👥', label: 'Users', path: '/admin/users' },
  { icon: '💳', label: 'Credits', path: '/admin/credits' },
  { icon: '🏷️', label: 'Pricing Plans', path: '/admin/pricing' },
  { icon: '📊', label: 'Reports', path: '/admin/reports' },
  { icon: '📨', label: 'Contact Requests', path: '/admin/contact-requests' },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout menuItems={menuItems}>
      <div className="max-w-7xl mx-auto w-full animate-fade-slide-in">
        <Routes>
          <Route index element={<DashboardOverview onNavigate={navigate} />} />
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="pricing" element={<PricingPlansPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="contact-requests" element={<ContactRequestsPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
