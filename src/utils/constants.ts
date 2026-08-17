// App-wide constants

export interface NavLink {
  label: string;
  href: string;
}

export const APP_NAME = 'EduGuard';
export const APP_DESCRIPTION = 'Automated Attendance & AI Proctoring Platform';

export const NAV_LINKS: NavLink[] = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how' },
  { label: 'Roles', href: '#roles' },
  { label: 'Students', href: '#student-feature' },
  { label: 'Admin', href: '#admin-feature' },
  { label: 'Pricing', href: '#pricing' },
];
