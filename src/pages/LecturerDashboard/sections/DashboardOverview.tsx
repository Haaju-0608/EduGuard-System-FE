import React from 'react';
import { FiAlertTriangle, FiCalendar, FiMonitor, FiRefreshCw, FiVideo, FiWifi, FiWifiOff } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import {
  AnimateIn,
  CameraScanBeam,
  LiveDot,
} from '../../../components/lecturer/LecturerAnimations';
import {
  CourseCodeBadge,
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
  fetchCameraFeeds,
  fetchLecturerKpis,
  fetchViolationAlerts,
} from '../../../services/lecturerApi';
import { fetchSchoolAdminOverviewStats } from '../../../services/schoolAdminApi';
import type { CameraFeed, ExamSlot, LecturerKpi, ViolationAlert } from '../../../types/lecturer';
import { getFacultyByCourseCode } from '../../../utils/facultyTheme';

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

/** Ô camera — scan beam + hover scale */
function CameraTile({ feed, index }: { feed: CameraFeed; index: number }) {
  const faculty = getFacultyByCourseCode(feed.classCode);

  return (
    <AnimateIn index={index % 8}>
      <div
        className={`proctor-tile group ${faculty.cardClass}
          ${feed.hasViolation ? 'proctor-tile-violation' : ''}
          ${!feed.isOnline ? 'proctor-tile-offline' : ''}
        `}
        style={{ borderColor: feed.hasViolation ? undefined : `${faculty.primary}33` }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-blue/10 border border-blue/20 grid place-items-center mb-2 group-hover:scale-110 transition-transform duration-300">
            <FiVideo className={`text-xl ${feed.isOnline ? 'text-cyan' : 'text-muted'}`} />
          </div>
          <span className="text-[10px] text-muted font-medium tracking-wide uppercase">Live Feed</span>
        </div>
        <div className="proctor-scanline" />
        <CameraScanBeam active={feed.isOnline} />

        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent p-3">
          <div className="flex items-end justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white-soft truncate">{feed.studentName}</p>
              <span className="inline-block mt-0.5">
                <CourseCodeBadge code={feed.classCode} facultyId={faculty.id} size="sm" />
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {feed.hasViolation && <LiveDot color="bg-red" />}
              {feed.isOnline ? <FiWifi className="text-green text-xs" /> : <FiWifiOff className="text-muted text-xs" />}
            </div>
          </div>
        </div>

        {feed.hasViolation && (
          <div className="absolute top-2 left-2 bg-red text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-lg animate-pulse">
            <FiAlertTriangle className="text-[10px]" /> VI PHẠM
          </div>
        )}

        {feed.isOnline && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-md px-2 py-0.5 border border-white/10">
            <LiveDot />
            <span className="text-[9px] text-white font-bold tracking-wider">REC</span>
          </div>
        )}
      </div>
    </AnimateIn>
  );
}

/** Cảnh báo vi phạm — slide từ phải */
function ViolationItem({ alert, index }: { alert: ViolationAlert; index: number }) {
  const severityBorder = {
    low: 'border-l-gold',
    medium: 'border-l-orange-400',
    high: 'border-l-red',
  };

  return (
    <div
      className={`animate-slide-in-right flex items-start gap-3 p-3.5 rounded-xl bg-navy/60 border border-border/60 border-l-[3px] ${severityBorder[alert.severity]} hover:bg-navy/80 transition-colors`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="w-9 h-9 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
        <FiAlertTriangle className="text-red text-sm" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-sm font-bold text-white-soft truncate">{alert.studentName}</p>
          <span className="text-[10px] text-muted font-mono shrink-0">{alert.timestamp}</span>
        </div>
        <p className="text-xs font-semibold text-red/90">{alert.type}</p>
        <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{alert.description}</p>
        <span className="inline-block mt-2"><CourseCodeBadge code={alert.classCode} size="sm" /></span>
      </div>
    </div>
  );
}

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
      const [kpis, cameras, violations] = await Promise.all([
        fetchLecturerKpis(),
        fetchCameraFeeds(),
        fetchViolationAlerts(),
      ]);
      return { mode: 'lecturer' as const, kpis, cameras, violations };
    },
    [isSchoolAdmin, user?.institutionId]
  );

  const kpis = data?.mode === 'lecturer' ? data.kpis : [];
  const cameras = data?.mode === 'lecturer' ? data.cameras : [];
  const violations = data?.mode === 'lecturer' ? data.violations : [];
  const schoolStats = data?.mode === 'schoolAdmin' ? data.stats : null;
  const onlineCount = cameras.filter((c) => c.isOnline).length;
  const violationCount = cameras.filter((c) => c.hasViolation).length;

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
    : [
        { label: 'Cameras online', value: `${onlineCount}/${cameras.length}`, icon: '📹' },
        { label: 'Violations', value: String(violationCount), icon: '⚠️' },
        { label: 'New Alerts', value: String(violations.length), icon: '🔔' },
        { label: 'Semester', value: 'Term 1 25-26', icon: '🎓' },
      ];

  return (
    <PageShell>
      <PageHeader
        eyebrow={isSchoolAdmin ? 'School Admin Portal' : 'Faculty Control Center'}
        title={<>Welcome back, <span className="text-gradient-blue-cyan">{lastName}</span></>}
        subtitle={
          isSchoolAdmin
            ? 'Manage courses, students, enrollments and exam schedules for your institution.'
            : 'Cross-faculty online classroom proctoring — monitor student cameras and resolve violation alerts.'
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
          <UniCard accent="cyan" hover={false} className="!p-6 h-full">
            <SectionTitle
              icon={<FiMonitor className="text-cyan" />}
              title="Online Proctoring Room"
              subtitle={`${onlineCount} students online · ${violationCount} need attention`}
              badge={
                <span className="flex items-center gap-1.5 text-[11px] text-green font-bold bg-green/10 border border-green/25 px-3 py-1 rounded-full">
                  <LiveDot color="bg-green" /> LIVE
                </span>
              }
            />

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="uni-skeleton aspect-[16/10] rounded-[14px]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {cameras.map((feed, i) => (
                  <CameraTile key={feed.id} feed={feed} index={i} />
                ))}
              </div>
            )}
          </UniCard>
        </AnimateIn>

        <AnimateIn index={3}>
          <UniCard accent="red" hover={false} className="!p-6 flex flex-col h-full">
            <SectionTitle
              icon={<FiAlertTriangle className="text-red" />}
              title="Violation Alerts"
              subtitle="List of events detected by AI"
              badge={
                <span className="text-xs font-bold text-red bg-red/10 border border-red/25 px-3 py-1 rounded-full">
                  {violations.length} new
                </span>
              }
            />

            <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar max-h-[620px]">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="uni-skeleton h-20 rounded-xl" />
                  ))
                : violations.map((alert, i) => (
                    <ViolationItem key={alert.id} alert={alert} index={i} />
                  ))
              }
            </div>
          </UniCard>
        </AnimateIn>
      </div>
        </>
      )}
    </PageShell>
  );
}
