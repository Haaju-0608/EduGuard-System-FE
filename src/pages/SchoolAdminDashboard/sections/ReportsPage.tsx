import React, { useState } from 'react';
import { FiDownload, FiBarChart2, FiPieChart, FiInfo, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import {
  fetchAttendanceReport,
  fetchViolationReport,
  fetchWalletReport,
  exportReport,
  type AttendanceReportItem,
} from '../../../services/adminApi';
import { fetchSchoolAdminClassesSimple } from '../../../services/schoolAdminApi';

// ─── Helpers ────────────────────────────────────────────────────────────────
// Không có bộ lọc Institution ở đây như bên SuperAdmin — SchoolAdmin chỉ quản lý đúng 1 trường,
// và BE tự scope report theo institution của token đăng nhập (không truyền institutionId).
// Cũng không có loại report "Revenue" — GET /api/reports/revenue chỉ SuperAdmin mới gọi được
// (RPT-TC14: non-SuperAdmin roles bị 403), SchoolAdmin chỉ xem được Attendance/Violations/Wallet.

const DATE_PRESETS = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'All Time'] as const;
type DatePreset = (typeof DATE_PRESETS)[number];

function computeDateRange(preset: DatePreset): { from?: string; to?: string } {
  if (preset === 'All Time') return {};
  const days = preset === 'Last 7 Days' ? 7 : preset === 'Last 90 Days' ? 90 : 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

const BAR_COLORS = ['bg-blue-bright', 'bg-cyan', 'bg-gold', 'bg-red', 'bg-green', 'bg-purple-400'];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const institutionId = user?.institutionId ?? '';
  const [datePreset, setDatePreset] = useState<DatePreset>('Last 30 Days');
  const [exportType, setExportType] = useState<'Attendance' | 'Violations' | 'Wallet'>('Attendance');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const { from, to } = computeDateRange(datePreset);
    const [attendance, violations, classes] = await Promise.all([
      fetchAttendanceReport({ from, to }),
      fetchViolationReport({ from, to }),
      fetchSchoolAdminClassesSimple({ pageSize: 200 }).catch(() => []),
    ]);
    return { attendance, violations, classNameById: new Map(classes.map((c) => [c.id, c.name])) };
  }, [datePreset]);

  // Realtime: cùng broadcast ResourceChanged/DashboardStatsChanged/ReportDataChanged như Dashboard
  // Overview — trang Reports trước đây chỉ đúng tại thời điểm load, phải bấm Refresh tay mới thấy
  // dữ liệu mới (vd 1 buổi điểm danh vừa xong, 1 violation vừa bị flag).
  const dashboardHub = useHubConnection(HubRoute.Dashboard, !!institutionId);
  useHubGroup(HubRoute.Dashboard, 'JoinInstitutionDashboard', institutionId ? [institutionId] : null);
  useHubEvent(dashboardHub, 'ResourceChanged', () => { reload(); });

  // Preview cho phần Export — Attendance/Violations dùng lại data đã fetch ở trên; Wallet fetch
  // riêng vì không nằm trong dashboard chính.
  const needsExportFetch = exportType === 'Wallet';
  const { data: exportPreview, loading: exportPreviewLoading } = useAsyncData(async () => {
    if (!needsExportFetch) return null;
    const { from, to } = computeDateRange(datePreset);
    return fetchWalletReport({ from, to });
  }, [exportType, datePreset]);

  const attendance = data?.attendance;
  const violations = data?.violations;
  const classNameById = data?.classNameById ?? new Map<string, string>();

  const examsMonitored = violations ? new Set(violations.items.map((i) => i.examSlotId)).size : 0;
  const avgAttendancePct = attendance ? Math.round(attendance.summary.averageRecognitionRate * 100) : 0;

  const kpis = [
    { label: 'Exams Monitored', value: String(examsMonitored), sub: `${attendance?.summary.sessions ?? 0} attendance sessions`, color: 'text-blue-bright', icon: '📝' },
    { label: 'Violations Flagged', value: String(violations?.summary.total ?? 0), sub: `${violations?.summary.reviewed ?? 0} reviewed`, color: 'text-red', icon: '⚠️' },
    { label: 'Avg Attendance', value: `${avgAttendancePct}%`, sub: `${attendance?.summary.totalRecognized ?? 0} students recognized`, color: 'text-green', icon: '✅' },
    { label: 'Completed Sessions', value: String(attendance?.summary.completed ?? 0), sub: `of ${attendance?.summary.sessions ?? 0} total`, color: 'text-cyan', icon: '📋' },
  ];

  // Gom attendance items theo class, tính tỉ lệ điểm danh trung bình mỗi lớp
  const classRates = (() => {
    if (!attendance) return [];
    const byClass = new Map<string, AttendanceReportItem[]>();
    attendance.items.forEach((it) => {
      // BE thỉnh thoảng trả về session attendance không gắn classId (dữ liệu cũ/orphan) —
      // bỏ qua khi group theo lớp thay vì crash trên classId.slice() sau này.
      if (!it.classId) return;
      const arr = byClass.get(it.classId) ?? [];
      arr.push(it);
      byClass.set(it.classId, arr);
    });
    return [...byClass.entries()]
      .map(([classId, items]) => {
        const rates = items.map((it) => (it.totalStudents === 0 ? 0 : it.totalRecognized / it.totalStudents));
        const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length;
        return {
          classId,
          className: classNameById.get(classId) ?? `Class …${classId.slice(-6)}`,
          ratePct: Math.round(avgRate * 100),
          sessions: items.length,
        };
      })
      .sort((a, b) => b.ratePct - a.ratePct)
      .slice(0, 6);
  })();

  const violationTypes = violations?.summary.byType.slice().sort((a, b) => b.count - a.count) ?? [];
  const violationTotal = violations?.summary.total ?? 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const { from, to } = computeDateRange(datePreset);
      await exportReport({
        reportType: exportType.toLowerCase() as 'attendance' | 'violations' | 'wallet',
        format: exportFormat,
        from,
        to,
      });
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Could not export the report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-syne font-extrabold text-2xl text-white-soft">Reports & Analytics</h1>
          <p className="text-muted font-dm text-sm mt-1">
            Attendance and violation reports for your institution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomSelect
            value={datePreset}
            onChange={(v) => setDatePreset(v as DatePreset)}
            options={DATE_PRESETS.map((p) => ({ value: p, label: p }))}
          />
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-cyan/40 transition-all bg-transparent disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-navy-card border border-red/30 rounded-[16px] p-4 text-sm text-red">{error}</div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-navy-card border border-border rounded-[16px] p-4 font-dm hover:border-cyan/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted font-medium">{kpi.label}</span>
              <span className="text-sm">{kpi.icon}</span>
            </div>
            <p className={`font-syne font-extrabold text-xl leading-none ${kpi.color} mb-1.5`}>
              {loading ? '…' : kpi.value}
            </p>
            <p className="text-[10px] text-muted flex items-center gap-0.5">
              <FiTrendingUp className="text-[9px]" />
              <span>{loading ? '' : kpi.sub}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Attendance by Class */}
        <div className="lg:col-span-3 bg-navy-card border border-border rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <FiBarChart2 className="text-blue-bright" />
              Attendance by Class
            </h3>
            <span className="text-xs text-muted font-dm">{datePreset}</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : classRates.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">No attendance sessions in this period.</p>
          ) : (
            <div className="space-y-3.5">
              {classRates.map((c, i) => (
                <div key={c.classId}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white-soft font-medium truncate">{c.className}</span>
                    <span className={`font-mono font-bold ${BAR_COLORS[i % BAR_COLORS.length].replace('bg-', 'text-')}`}>{c.ratePct}%</span>
                  </div>
                  <div className="w-full h-2 bg-navy rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                      style={{ width: `${Math.min(100, c.ratePct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Violation Types */}
        <div className="lg:col-span-2 bg-navy-card border border-border rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <FiPieChart className="text-red" />
              Violation Types
            </h3>
            <span className="text-xs text-muted font-dm">{violationTotal} total</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-6 bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : violationTypes.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">No violations in this period.</p>
          ) : (
            <div className="space-y-3">
              {violationTypes.map((v, i) => {
                const pct = violationTotal === 0 ? 0 : Math.round((v.count / violationTotal) * 100);
                return (
                  <div key={v.type}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-white-soft font-medium">{v.type}</span>
                      <span className="text-muted">{v.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-navy rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Export */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-navy-card border border-border rounded-[16px] p-5">
          <h3 className="font-syne font-bold text-white-soft text-base mb-4 flex items-center gap-2">
            <FiDownload className="text-cyan" />
            Export Report
          </h3>

          <div className="space-y-4 font-dm text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-muted font-medium mb-1.5">Report Type</label>
                <CustomSelect
                  value={exportType}
                  onChange={(v) => setExportType(v as typeof exportType)}
                  options={[
                    { value: 'Attendance', label: 'Attendance Log' },
                    { value: 'Violations', label: 'Proctoring Violations' },
                    { value: 'Wallet', label: 'Wallet Transactions' },
                  ]}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-muted font-medium mb-1.5">Format</label>
                <CustomSelect
                  value={exportFormat}
                  onChange={(v) => setExportFormat(v as typeof exportFormat)}
                  options={[
                    { value: 'xlsx', label: 'Excel (.xlsx)' },
                    { value: 'pdf', label: 'PDF' },
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 bg-navy/40 border border-border/60 rounded-xl p-3 text-xs text-muted">
              <FiInfo className="text-cyan text-sm shrink-0 mt-0.5" />
              <p>
                Generated on the server for the selected report type and date range — styled Excel or
                paginated PDF, downloaded straight from the backend.
              </p>
            </div>

            <button
              onClick={() => void handleExport()}
              disabled={exporting}
              className="flex items-center justify-center gap-2 bg-linear-to-r from-blue to-blue-bright text-white font-semibold py-2.5 px-5 rounded-xl cursor-pointer hover:brightness-110 shadow-lg transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              <FiDownload className="text-sm" />
              <span>{exporting ? 'Generating…' : `Download ${exportFormat.toUpperCase()}`}</span>
            </button>
          </div>
        </div>

        {/* Live preview of what will be exported */}
        <div className="lg:col-span-2 bg-navy-card border border-border rounded-[16px] p-5">
          <h3 className="font-syne font-bold text-white-soft text-base mb-4">Report Preview</h3>
          {exportType === 'Attendance' && (
            <div className="space-y-2 text-sm">
              <PreviewRow label="Sessions" value={attendance?.summary.sessions} loading={loading} />
              <PreviewRow label="Completed" value={attendance?.summary.completed} loading={loading} />
              <PreviewRow label="Total recognized" value={attendance?.summary.totalRecognized} loading={loading} />
              <PreviewRow label="Avg recognition rate" value={attendance ? `${avgAttendancePct}%` : undefined} loading={loading} />
            </div>
          )}
          {exportType === 'Violations' && (
            <div className="space-y-2 text-sm">
              <PreviewRow label="Total violations" value={violations?.summary.total} loading={loading} />
              <PreviewRow label="Reviewed" value={violations?.summary.reviewed} loading={loading} />
              <PreviewRow label="Types" value={violations?.summary.byType.length} loading={loading} />
            </div>
          )}
          {exportType === 'Wallet' && (
            <div className="space-y-2 text-sm">
              <PreviewRow label="Transactions" value={exportPreview?.summary.totalTransactions} loading={exportPreviewLoading} />
              <PreviewRow label="Success amount" value={exportPreview?.summary.successAmount} loading={exportPreviewLoading} />
              <PreviewRow label="Top-up amount" value={exportPreview?.summary.topUpAmount} loading={exportPreviewLoading} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value, loading }: { label: string; value: string | number | undefined; loading: boolean }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-navy/40 border border-border/40">
      <span className="text-muted text-xs">{label}</span>
      <span className="text-white-soft font-semibold font-mono text-xs">
        {loading ? '…' : value ?? '—'}
      </span>
    </div>
  );
}
