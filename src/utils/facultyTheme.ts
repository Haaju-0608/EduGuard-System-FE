import type { IconType } from 'react-icons';
import { FiBarChart2, FiBriefcase, FiCpu, FiGlobe, FiTool } from 'react-icons/fi';

/** Mã khoa / ngành trong hệ thống */
export type FacultyId = 'it' | 'economics' | 'business' | 'engineering' | 'foreign-lang';

/** Cấu hình màu sắc & icon theo từng khoa */
export interface FacultyTheme {
  id: FacultyId;
  name: string;
  shortName: string;
  icon: IconType;
  emoji: string;
  primary: string;
  bright: string;
  gradient: string;
  badgeClass: string;
  cardClass: string;
  textClass: string;
  borderClass: string;
  glowClass: string;
}

/** Bảng màu & icon cho từng khoa đại học */
export const FACULTY_THEMES: Record<FacultyId, FacultyTheme> = {
  it: {
    id: 'it',
    name: 'Công nghệ Thông tin',
    shortName: 'CNTT',
    icon: FiCpu,
    emoji: '💻',
    primary: '#2563EB',
    bright: '#3B82F6',
    gradient: 'from-blue to-cyan',
    badgeClass: 'fac-badge-it',
    cardClass: 'fac-card-it',
    textClass: 'text-blue-bright',
    borderClass: 'border-blue/30',
    glowClass: 'shadow-[0_8px_32px_rgba(37,99,235,0.15)]',
  },
  economics: {
    id: 'economics',
    name: 'Kinh tế',
    shortName: 'Kinh tế',
    icon: FiBarChart2,
    emoji: '📊',
    primary: '#D97706',
    bright: '#F59E0B',
    gradient: 'from-gold to-orange-400',
    badgeClass: 'fac-badge-economics',
    cardClass: 'fac-card-economics',
    textClass: 'text-gold',
    borderClass: 'border-gold/30',
    glowClass: 'shadow-[0_8px_32px_rgba(245,158,11,0.15)]',
  },
  business: {
    id: 'business',
    name: 'Quản trị Kinh doanh',
    shortName: 'QTKD',
    icon: FiBriefcase,
    emoji: '💼',
    primary: '#059669',
    bright: '#10B981',
    gradient: 'from-green to-emerald-400',
    badgeClass: 'fac-badge-business',
    cardClass: 'fac-card-business',
    textClass: 'text-green',
    borderClass: 'border-green/30',
    glowClass: 'shadow-[0_8px_32px_rgba(16,185,129,0.15)]',
  },
  engineering: {
    id: 'engineering',
    name: 'Kỹ thuật',
    shortName: 'Kỹ thuật',
    icon: FiTool,
    emoji: '⚙️',
    primary: '#EA580C',
    bright: '#F97316',
    gradient: 'from-orange-500 to-amber-400',
    badgeClass: 'fac-badge-engineering',
    cardClass: 'fac-card-engineering',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-400/30',
    glowClass: 'shadow-[0_8px_32px_rgba(249,115,22,0.15)]',
  },
  'foreign-lang': {
    id: 'foreign-lang',
    name: 'Ngoại ngữ',
    shortName: 'Ngoại ngữ',
    icon: FiGlobe,
    emoji: '🌍',
    primary: '#7C3AED',
    bright: '#A78BFA',
    gradient: 'from-violet-500 to-purple-400',
    badgeClass: 'fac-badge-foreign-lang',
    cardClass: 'fac-card-foreign-lang',
    textClass: 'text-violet-400',
    borderClass: 'border-violet-400/30',
    glowClass: 'shadow-[0_8px_32px_rgba(124,58,237,0.15)]',
  },
};

/** Lấy theme khoa theo ID */
export function getFacultyTheme(facultyId: FacultyId): FacultyTheme {
  return FACULTY_THEMES[facultyId];
}

/** Suy luận khoa từ mã học phần (CS→CNTT, ECO→Kinh tế, …) */
export function getFacultyByCourseCode(code: string): FacultyTheme {
  const prefix = code.replace(/[0-9]/g, '').toUpperCase();

  if (['CS', 'IT', 'SE', 'IS'].includes(prefix)) return FACULTY_THEMES.it;
  if (['ECO', 'ECN', 'FIN'].includes(prefix)) return FACULTY_THEMES.economics;
  if (['BUS', 'MKT', 'BA', 'MGT'].includes(prefix)) return FACULTY_THEMES.business;
  if (['ME', 'EE', 'CE', 'ENG'].includes(prefix)) return FACULTY_THEMES.engineering;
  if (['EN', 'LANG', 'FR', 'JP'].includes(prefix)) return FACULTY_THEMES['foreign-lang'];

  return FACULTY_THEMES.it;
}

/** Danh sách tất cả khoa — dùng cho filter */
export function getAllFaculties(): FacultyTheme[] {
  return Object.values(FACULTY_THEMES);
}

/** Map department string (AuthContext) sang FacultyId */
export function getFacultyByDepartment(dept: string): FacultyId {
  const lower = dept.toLowerCase();
  if (lower.includes('information') || lower.includes('cntt') || lower.includes('công nghệ')) return 'it';
  if (lower.includes('kinh tế') || lower.includes('economics')) return 'economics';
  if (lower.includes('quản trị') || lower.includes('business')) return 'business';
  if (lower.includes('kỹ thuật') || lower.includes('engineering')) return 'engineering';
  if (lower.includes('ngoại ngữ') || lower.includes('language')) return 'foreign-lang';
  return 'it';
}
