import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiMonitor, FiRefreshCw, FiVideo, FiWifi, FiWifiOff } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import {
  CourseCodeBadge,
  EmptyState,
  FacultyBadge,
  PageHeader,
  PageShell,
  PrimaryButton,
  SectionTitle,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import { fetchCameraFeeds, fetchLecturerKpis, fetchViolationAlerts } from '../../../services/lecturerApi';
import type { CameraFeed, LecturerKpi, ViolationAlert } from '../../../types/lecturer';
import { getFacultyByCourseCode, getFacultyByDepartment } from '../../../utils/facultyTheme';

const KPI_ACCENTS = ['uni-kpi-blue', 'uni-kpi-cyan', 'uni-kpi-green', 'uni-kpi-red'];

/** Hiển thị KPI card kiểu portal đại học */
function KpiCard({ kpi, index }: { kpi: LecturerKpi; index: number }) {
  return (
    <div className={`uni-kpi-card ${KPI_ACCENTS[index % KPI_ACCENTS.length]}`}>
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
  );
}

/** Ô camera giám sát — viền màu theo khoa */
function CameraTile({ feed }: { feed: CameraFeed }) {
  const faculty = getFacultyByCourseCode(feed.classCode);

  return (
    <div
      className={`proctor-tile group ${faculty.cardClass}
        ${feed.hasViolation ? 'proctor-tile-violation' : ''}
        ${!feed.isOnline ? 'proctor-tile-offline' : ''}
      `}
      style={{ borderColor: feed.hasViolation ? undefined : `${faculty.primary}33` }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-blue/10 border border-blue/20 grid place-items-center mb-2 group-hover:scale-110 transition-transform">
          <FiVideo className={`text-xl ${feed.isOnline ? 'text-cyan' : 'text-muted'}`} />
        </div>
        <span className="text-[10px] text-muted font-medium tracking-wide uppercase">Live Feed</span>
      </div>
      <div className="proctor-scanline" />

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent p-3">
        <div className="flex items-end justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white-soft truncate">{feed.studentName}</p>
            <span className="inline-block mt-0.5"><CourseCodeBadge code={feed.classCode} facultyId={faculty.id} size="sm" /></span>
          </div>
          <div className="flex items-center gap-1.5">
            {feed.hasViolation && <span className="w-2 h-2 bg-red rounded-full animate-pulse" />}
            {feed.isOnline ? <FiWifi className="text-green text-xs" /> : <FiWifiOff className="text-muted text-xs" />}
          </div>
        </div>
      </div>

      {feed.hasViolation && (
        <div className="absolute top-2 left-2 bg-red text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-lg">
          <FiAlertTriangle className="text-[10px]" /> VI PHẠM
        </div>
      )}

      {feed.isOnline && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-2 py-0.5 border border-white/10">
          <span className="w-1.5 h-1.5 bg-red rounded-full animate-pulse" />
          <span className="text-[9px] text-white font-bold tracking-wider">REC</span>
        </div>
      )}
    </div>
  );
}

/** Một dòng cảnh báo vi phạm */
function ViolationItem({ alert }: { alert: ViolationAlert }) {
  const severityBorder = {
    low: 'border-l-gold',
    medium: 'border-l-orange-400',
    high: 'border-l-red',
  };

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl bg-navy/60 border border-border/60 border-l-[3px] ${severityBorder[alert.severity]} hover:bg-navy/80 transition-colors`}>
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

/** Dashboard giảng viên — lưới camera + cảnh báo vi phạm */
export default function DashboardOverview() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<LecturerKpi[]>([]);
  const [cameras, setCameras] = useState<CameraFeed[]>([]);
  const [violations, setViolations] = useState<ViolationAlert[]>([]);
  const [loading, setLoading] = useState(true);

  /** Tải dữ liệu dashboard từ API */
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [kpiData, cameraData, violationData] = await Promise.all([
        fetchLecturerKpis(),
        fetchCameraFeeds(),
        fetchViolationAlerts(),
      ]);
      setKpis(kpiData);
      setCameras(cameraData);
      setViolations(violationData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onlineCount = cameras.filter((c) => c.isOnline).length;
  const violationCount = cameras.filter((c) => c.hasViolation).length;
  const lastName = user?.name?.split(' ').slice(-1)[0] ?? 'Thầy/Cô';
  const homeFaculty = user?.department ? getFacultyByDepartment(user.department) : 'it';

  return (
    <PageShell>
      <PageHeader
        eyebrow="Faculty Control Center"
        title={<>Xin chào, <span className="text-gradient-blue-cyan">{lastName}</span></>}
        subtitle="Giám sát lớp học trực tuyến đa khoa — theo dõi camera sinh viên và xử lý cảnh báo vi phạm."
        facultyId={homeFaculty}
        actions={
          <PrimaryButton variant="ghost" onClick={loadDashboardData} disabled={loading}>
            <FiRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </PrimaryButton>
        }
        stats={[
          { label: 'Camera online', value: `${onlineCount}/${cameras.length}`, icon: '📹' },
          { label: 'Vi phạm', value: String(violationCount), icon: '⚠️' },
          { label: 'Cảnh báo mới', value: String(violations.length), icon: '🔔' },
          { label: 'Học kỳ', value: 'HK1 25-26', icon: '🎓' },
        ]}
      />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="uni-skeleton h-[120px] rounded-[18px]" />
            ))
          : kpis.map((kpi, i) => <KpiCard key={kpi.label} kpi={kpi} index={i} />)
        }
      </div>

      {/* Camera + Violations */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <UniCard accent="cyan" hover={false} className="!p-6">
          <SectionTitle
            icon={<FiMonitor className="text-cyan" />}
            title="Phòng giám sát trực tuyến"
            subtitle={`${onlineCount} sinh viên đang online · ${violationCount} cần chú ý`}
            badge={
              <span className="flex items-center gap-1.5 text-[11px] text-green font-bold bg-green/10 border border-green/25 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" /> LIVE
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
              {cameras.map((feed) => (
                <CameraTile key={feed.id} feed={feed} />
              ))}
            </div>
          )}
        </UniCard>

        <UniCard accent="red" hover={false} className="!p-6 flex flex-col">
          <SectionTitle
            icon={<FiAlertTriangle className="text-red" />}
            title="Cảnh báo vi phạm"
            subtitle="Danh sách sự kiện AI phát hiện"
            badge={
              <span className="text-xs font-bold text-red bg-red/10 border border-red/25 px-3 py-1 rounded-full">
                {violations.length} mới
              </span>
            }
          />

          <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar max-h-[620px]">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="uni-skeleton h-20 rounded-xl" />
                ))
              : violations.map((alert) => (
                  <ViolationItem key={alert.id} alert={alert} />
                ))
            }
          </div>
        </UniCard>
      </div>
    </PageShell>
  );
}
