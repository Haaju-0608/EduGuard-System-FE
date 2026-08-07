import React from 'react';
import { FiAlertTriangle, FiCalendar, FiMonitor, FiRefreshCw, FiUser } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  EmptyState,
  PageHeader,
  PageShell,
  PrimaryButton,
  SectionTitle,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useLecturerFaculty } from '../../../hooks/useLecturerFaculty';
import {
  fetchLecturerKpis,
  fetchViolationLogs,
  fetchParticipationById,
} from '../../../services/lecturerApi';
import { fetchSchoolAdminOverviewStats } from '../../../services/schoolAdminApi';
import { getViolationLabel } from '../../../utils/violationLabels';
import type { ExamSlot, LecturerKpi } from '../../../types/lecturer';
import type { ApiViolationLog, ApiExamParticipation } from '../../../types/api';

const KPI_ACCENTS = ['uni-kpi-blue', 'uni-kpi-cyan', 'uni-kpi-green', 'uni-kpi-red'];

/** KPI card với stagger animation */
function KpiCard({ kpi, index }: { kpi: LecturerKpi; index: number }) {
  return (
    <AnimateIn index={index}>
      <div className={`uni-kpi-card h-full ${KPI_ACCENTS[index % KPI_ACCENTS.length]}`}>
        <div className="flex items-start justify-between mb-3">
          <span className="text-2xl">{kpi.icon}</span>
          {kpi.change && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/5 ${kpi.changeColor ?? 'text-muted'}`}>
              {kpi.change}
            </span>
          )}
        </div>
        <p className={`font-syne font-extrabold text-[1.85rem] ${kpi.colorClass}`}>{kpi.value}</p>
        <p className="text-muted text-sm mt-1">{kpi.label}</p>
      </div>
    </AnimateIn>
  );
}

// 1 exam attempt (participation) = 1 nhóm vi phạm, giống trang Violations — tránh liệt kê từng
// vi phạm riêng lẻ (1 học sinh có thể có nhiều vi phạm cùng lúc, làm danh sách dài vô nghĩa).
interface ViolationGroup {
  participationId: string;
  logs: ApiViolationLog[];
  participation: ApiExamParticipation | null;
}

function groupViolationsByParticipation(logs: ApiViolationLog[]): Omit<ViolationGroup, 'participation'>[] {
  const map = new Map<string, ApiViolationLog[]>();
  logs.forEach((l) => {
    const arr = map.get(l.participationId) ?? [];
    arr.push(l);
    map.set(l.participationId, arr);
  });
  return [...map.entries()]
    .map(([participationId, groupLogs]) => ({
      participationId,
      logs: [...groupLogs].sort(
        (a, b) => new Date(b.recordedAt ?? b.createdAt).getTime() - new Date(a.recordedAt ?? a.createdAt).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.logs[0].recordedAt ?? b.logs[0].createdAt).getTime() -
        new Date(a.logs[0].recordedAt ?? a.logs[0].createdAt).getTime(),
    );
}

/** Cảnh báo vi phạm — 1 thẻ = 1 lượt thi, bấm vào chuyển sang trang Violations đầy đủ */
function ViolationItem({ group, index }: { group: ViolationGroup; index: number }) {
  const studentName = group.participation?.student?.fullName ?? group.participation?.student?.email ?? null;
  const latest = group.logs[0];
  const viol = getViolationLabel(latest.violationType);
  const hasSevere = group.logs.some((l) => l.severity === 'Severe');

  return (
    <Link
      to="/lecture/violations"
      className={`animate-slide-in-right flex items-start gap-3 p-3.5 rounded-xl bg-navy/60 border border-border/60 border-l-[3px] no-underline hover:bg-navy/80 transition-colors ${hasSevere ? 'border-l-red' : 'border-l-gold'}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="w-9 h-9 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0 text-base">
        {viol.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-sm font-bold text-white-soft truncate flex items-center gap-1.5">
            <FiUser size={11} className="text-muted shrink-0" />
            {studentName ?? `Student …${group.participationId.slice(-6)}`}
          </p>
          <span className="text-[10px] text-muted font-mono shrink-0">
            {new Date(latest.recordedAt ?? latest.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs font-semibold text-red/90">
          {viol.icon} {viol.label}
          {group.logs.length > 1 && <span className="text-muted font-normal"> +{group.logs.length - 1} more</span>}
        </p>
      </div>
    </Link>
  );
}

// Dashboard chỉ hiện N lượt thi có vi phạm gần nhất (không phải TOÀN BỘ danh sách) — xem hết ở
// trang Violations riêng (đã gộp nhóm + phân trang + filter đầy đủ).
const DASHBOARD_VIOLATION_LIMIT = 5;

/** Dashboard giảng viên */
export default function DashboardOverview() {
  const { facultyId, lastName } = useLecturerFaculty();
  const { user } = useAuth();
  const toast = useToast();
  const isSchoolAdmin = user?.apiRole?.toLowerCase().includes('schooladmin');

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      if (isSchoolAdmin) {
        const stats = await fetchSchoolAdminOverviewStats(user?.institutionId ?? undefined);
        return { mode: 'schoolAdmin' as const, stats };
      }
      const [rawKpis, violationLogs] = await Promise.all([
        fetchLecturerKpis(user?.id),
        fetchViolationLogs({ pageSize: 30 }),
      ]);

      const topGroups = groupViolationsByParticipation(violationLogs.items).slice(0, DASHBOARD_VIOLATION_LIMIT);
      const participations = await Promise.all(
        topGroups.map((g) => fetchParticipationById(g.participationId)),
      );
      const violationGroups: ViolationGroup[] = topGroups.map((g, i) => ({ ...g, participation: participations[i] }));

      // fetchLecturerKpis() để "Violations Today" cứng = '0' (BE chưa có endpoint đếm riêng) —
      // tính lại từ chính violationLogs vừa fetch (trong pageSize hiện tại) thay vì để sai số liệu.
      const todayStr = new Date().toDateString();
      const violationsToday = violationLogs.items.filter(
        (l) => new Date(l.recordedAt ?? l.createdAt).toDateString() === todayStr,
      ).length;
      const kpis = rawKpis.map((k) =>
        k.label === 'Violations Today' ? { ...k, value: String(violationsToday) } : k,
      );

      return {
        mode: 'lecturer' as const,
        kpis,
        violationGroups,
        totalViolationCount: violationLogs.pagination.totalItems,
      };
    },
    [isSchoolAdmin, user?.institutionId]
  );

  const kpis = data?.mode === 'lecturer' ? data.kpis : [];
  const violationGroups = data?.mode === 'lecturer' ? data.violationGroups : [];
  const totalViolationCount = data?.mode === 'lecturer' ? data.totalViolationCount : 0;
  const schoolStats = data?.mode === 'schoolAdmin' ? data.stats : null;

  const handleRefresh = async () => {
    const ok = await reload();
    if (ok) toast.success('Refreshed', 'Dashboard data has been updated.');
    else toast.error('Error loading data', 'Unable to connect to the server. Try again later.');
  };

  if (error && !loading && !data) {
    return (
      <PageShell>
        <EmptyState variant="error" title="Failed to load dashboard" description={error} onRetry={reload} />
      </PageShell>
    );
  }

  const headerStats = isSchoolAdmin && schoolStats
    ? [
        { label: 'Courses', value: String(schoolStats.classCount), icon: '📚' },
        { label: 'Students', value: String(schoolStats.studentCount), icon: '👥' },
        { label: 'Exam Slots', value: String(schoolStats.examCount), icon: '📝' },
        { label: 'Enrollments', value: String(schoolStats.enrollmentCount), icon: '📋' },
      ]
    : undefined;

  return (
    <PageShell>
      <PageHeader
        eyebrow={isSchoolAdmin ? 'School Admin Portal' : 'Faculty Control Center'}
        title={<>Welcome back, <span className="text-gradient-blue-cyan">{lastName}</span></>}
        subtitle={
          isSchoolAdmin
            ? 'Manage courses, students, enrollments and exam schedules for your institution.'
            : 'Cross-faculty exam proctoring — track classes, exams and AI-detected violation alerts.'
        }
        facultyId={facultyId}
        actions={
          <PrimaryButton variant="ghost" onClick={handleRefresh} disabled={loading}>
            <FiRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </PrimaryButton>
        }
        stats={headerStats}
      />

      {isSchoolAdmin ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <AnimateIn index={1}>
            <UniCard accent="cyan" hover={false} className="!p-6">
              <SectionTitle
                icon={<FiCalendar className="text-cyan" />}
                title="Upcoming Exams"
                subtitle={`${schoolStats?.upcomingExamCount ?? 0} scheduled or ongoing sessions`}
                badge={
                  <Link to="/lecture/exams" className="text-xs font-bold text-cyan no-underline hover:underline">
                    View all →
                  </Link>
                }
              />
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="uni-skeleton h-20 rounded-xl" />
                  ))}
                </div>
              ) : (schoolStats?.upcomingExams.length ?? 0) === 0 ? (
                <p className="text-muted text-sm py-8 text-center">No upcoming exam slots.</p>
              ) : (
                <div className="space-y-3">
                  {schoolStats!.upcomingExams.map((exam: ExamSlot) => (
                    <div key={exam.id} className="bg-navy/40 border border-border/50 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-syne font-bold text-white-soft">{exam.examName}</p>
                          <p className="text-sm text-muted mt-1">{exam.classCode} — {exam.className}</p>
                        </div>
                        <span className="text-[10px] font-bold text-blue-bright bg-blue/10 border border-blue/25 px-2 py-1 rounded-full uppercase">
                          {exam.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-3">
                        {new Date(exam.startTime).toLocaleString('en-GB')} → {new Date(exam.endTime).toLocaleString('en-GB')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </UniCard>
          </AnimateIn>

          <AnimateIn index={2}>
            <UniCard accent="blue" hover={false} className="!p-6">
              <SectionTitle
                icon={<FiMonitor className="text-blue-bright" />}
                title="Quick Links"
                subtitle="Common management tasks"
              />
              <div className="grid grid-cols-1 gap-2 mt-2">
                {[
                  { label: 'Course Management', path: '/lecture/classes', icon: '📚' },
                  { label: 'Student Registry', path: '/lecture/students', icon: '👥' },
                  { label: 'Exam Slots', path: '/lecture/exams', icon: '📝' },
                  { label: 'Attendance', path: '/lecture/attendance', icon: '📋' },
                ].map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-3 bg-navy/40 border border-border/50 rounded-xl px-4 py-3 no-underline hover:border-cyan/30 transition-colors"
                  >
                    <span>{item.icon}</span>
                    <span className="text-sm font-semibold text-white-soft">{item.label}</span>
                  </Link>
                ))}
              </div>
            </UniCard>
          </AnimateIn>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="uni-skeleton h-[120px] rounded-[18px]" />
                ))
              : kpis.map((kpi, i) => <KpiCard key={kpi.label} kpi={kpi} index={i} />)
            }
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
            <AnimateIn index={2}>
              <UniCard accent="red" hover={false} className="!p-6 h-full">
                <SectionTitle
                  icon={<FiAlertTriangle className="text-red" />}
                  title="Violation Alerts"
                  subtitle={`${totalViolationCount} events detected by AI across all exams`}
                  badge={
                    <Link to="/lecture/violations" className="text-xs font-bold text-red no-underline hover:underline">
                      View all →
                    </Link>
                  }
                />

                <div className="space-y-2.5">
                  {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="uni-skeleton h-20 rounded-xl" />
                      ))
                    : violationGroups.length === 0
                      ? <p className="text-muted text-sm py-8 text-center">No violation alerts.</p>
                      : violationGroups.map((group, i) => (
                          <ViolationItem key={group.participationId} group={group} index={i} />
                        ))
                  }
                </div>
              </UniCard>
            </AnimateIn>

            <AnimateIn index={3}>
              <UniCard accent="blue" hover={false} className="!p-6 h-full">
                <SectionTitle
                  icon={<FiMonitor className="text-blue-bright" />}
                  title="Quick Links"
                  subtitle="Common management tasks"
                />
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {[
                    { label: 'Course Management', path: '/lecture/classes', icon: '📚' },
                    { label: 'Student Registry', path: '/lecture/students', icon: '👥' },
                    { label: 'Exam Slots', path: '/lecture/exams', icon: '📝' },
                    { label: 'Attendance', path: '/lecture/attendance', icon: '📋' },
                  ].map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="flex items-center gap-3 bg-navy/40 border border-border/50 rounded-xl px-4 py-3 no-underline hover:border-blue-bright/30 transition-colors"
                    >
                      <span>{item.icon}</span>
                      <span className="text-sm font-semibold text-white-soft">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </UniCard>
            </AnimateIn>
          </div>
        </>
      )}
    </PageShell>
  );
}
