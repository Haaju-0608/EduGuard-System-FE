import React, { useState } from 'react';
import { FiDownload, FiPieChart, FiInfo, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import {
  fetchAttendanceReport,
  fetchViolationReport,
  fetchWalletReport,
  fetchRevenueReport,
  fetchInstitutions,
  exportReport,
} from '../../../services/adminApi';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** period từ BE dạng "YYYY-MM" (groupBy=month). `short=true` -> chỉ "Jan" (label trục X, tránh đè
 *  nhau khi có đủ 12 cột); `short=false` -> "Jan 2026" (tooltip đầy đủ). */
function formatMonthPeriod(period: string, short = false): string {
  const [year, month] = period.split('-');
  const idx = Number(month) - 1;
  if (idx < 0 || idx >= 12) return period;
  return short ? MONTH_NAMES[idx] : `${MONTH_NAMES[idx]} ${year}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const toast = useToast();
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('Last 30 Days');
  const [exportType, setExportType] = useState<'Attendance' | 'Violations' | 'Wallet' | 'Revenue'>('Attendance');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [exporting, setExporting] = useState(false);

  const { data: instData } = useAsyncData(() => fetchInstitutions({ page: 1, pageSize: 100 }), []);
  const institutions = instData?.items ?? [];

  const { data, loading, error, reload } = useAsyncData(async () => {
    const { from, to } = computeDateRange(datePreset);
    const institutionId = institutionFilter || undefined;
    const [attendance, violations, revenue] = await Promise.all([
      fetchAttendanceReport({ institutionId, from, to }),
      fetchViolationReport({ institutionId, from, to }),
      fetchRevenueReport({ from, to, groupBy: 'month' }),
    ]);
    return { attendance, violations, revenue };
  }, [institutionFilter, datePreset]);

  // Realtime: cùng broadcast ResourceChanged/DashboardStatsChanged/ReportDataChanged như Dashboard
  // Overview — trang Reports trước đây chỉ đúng tại thời điểm load, phải bấm Refresh tay mới thấy
  // dữ liệu mới (vd 1 buổi điểm danh vừa xong, 1 violation vừa bị flag).
  const dashboardHub = useHubConnection(HubRoute.Dashboard, true);
  useHubGroup(HubRoute.Dashboard, 'JoinSystemDashboard', []);
  useHubEvent(dashboardHub, 'ResourceChanged', () => { reload(); });

  // Chart "Monthly Revenue" cố định 12 tháng gần nhất — KHÔNG theo datePreset ở trên (Last 7/30/90
  // Days) vì group-by-month mà chỉ lọc vài chục ngày thì đa số chỉ ra đúng 1 cột, nhìn trống trải.
  // Đây là chart xu hướng nên luôn hiện đủ 12 tháng bất kể bộ lọc chính đang chọn gì.
  const { data: chartRevenue, loading: chartRevenueLoading } = useAsyncData(async () => {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 11);
    from.setDate(1);
    return fetchRevenueReport({ from: from.toISOString(), to: to.toISOString(), groupBy: 'month' });
  }, []);

  // Preview cho phần Export — Attendance/Violations/Revenue dùng lại data đã fetch ở trên; chỉ
  // Wallet còn fetch riêng vì SuperAdmin mới xem được và không nằm trong dashboard chính.
  const needsExportFetch = exportType === 'Wallet';
  const { data: exportPreview, loading: exportPreviewLoading } = useAsyncData(async () => {
    if (!needsExportFetch) return null;
    const { from, to } = computeDateRange(datePreset);
    const institutionId = institutionFilter || undefined;
    return fetchWalletReport({ institutionId, from, to });
  }, [exportType, institutionFilter, datePreset]);

  const attendance = data?.attendance;
  const violations = data?.violations;
  const revenue = data?.revenue;

  const examsMonitored = violations ? new Set(violations.items.map((i) => i.examSlotId)).size : 0;
  const avgAttendancePct = attendance ? Math.round(attendance.summary.averageRecognitionRate * 100) : 0;
  const totalRevenue = revenue ? revenue.summary.topUpAmount + revenue.summary.serviceFeeAmount : 0;

  const kpis = [
    { label: 'Exams Monitored', value: String(examsMonitored), sub: `${attendance?.summary.sessions ?? 0} attendance sessions`, color: 'text-blue-bright', icon: '📝' },
    { label: 'Violations Flagged', value: String(violations?.summary.total ?? 0), sub: `${violations?.summary.reviewed ?? 0} reviewed`, color: 'text-red', icon: '⚠️' },
    { label: 'Avg Attendance', value: `${avgAttendancePct}%`, sub: `${attendance?.summary.totalRecognized ?? 0} students recognized`, color: 'text-green', icon: '✅' },
    { label: 'Completed Sessions', value: String(attendance?.summary.completed ?? 0), sub: `of ${attendance?.summary.sessions ?? 0} total`, color: 'text-cyan', icon: '📋' },
    { label: 'Revenue', value: totalRevenue.toLocaleString(), sub: `${revenue?.summary.transactionCount ?? 0} transactions`, color: 'text-gold', icon: '💰' },
  ];

  const violationTypes = violations?.summary.byType.slice().sort((a, b) => b.count - a.count) ?? [];
  const violationTotal = violations?.summary.total ?? 0;

  const monthlyRevenue = (chartRevenue?.items ?? []).map((item) => ({
    period: item.period,
    total: item.topUpAmount + item.serviceFeeAmount,
  }));
  const monthlyRevenueTotal = monthlyRevenue.reduce((sum, m) => sum + m.total, 0);
  const maxMonthlyRevenue = Math.max(1, ...monthlyRevenue.map((m) => m.total));

  const handleExport = async () => {
    setExporting(true);
    try {
      const { from, to } = computeDateRange(datePreset);
      await exportReport({
        reportType: exportType.toLowerCase() as 'attendance' | 'violations' | 'wallet' | 'revenue',
        format: exportFormat,
        institutionId: institutionFilter || undefined,
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
            Real-time attendance and violation reports across the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomSelect
            value={institutionFilter}
            onChange={setInstitutionFilter}
            options={[{ value: '', label: 'All Institutions' }, ...institutions.map((i) => ({ value: i.id, label: i.name ?? i.id }))]}
          />
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Violation Types */}
        <div className="bg-navy-card border border-border rounded-[16px] p-5">
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

        {/* Monthly Revenue — flex-col + flex-1 bên dưới để chart luôn giãn lấp đầy chiều cao card
            (card này bị grid canh cao bằng card Violation Types kế bên, chart set height cứng thì
            để trống phía dưới). */}
        <div className="bg-navy-card border border-border rounded-[16px] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <span className="text-gold">💰</span>
              Monthly Revenue
            </h3>
            <span className="text-xs text-muted font-dm">{monthlyRevenueTotal.toLocaleString()} · last 12 months</span>
          </div>

          {chartRevenueLoading ? (
            <div className="flex-1 min-h-56 bg-white/5 rounded-lg animate-pulse" />
          ) : monthlyRevenue.length === 0 || monthlyRevenueTotal === 0 ? (
            <p className="flex-1 min-h-56 grid place-items-center text-muted text-sm text-center">No revenue recorded in the last 12 months.</p>
          ) : (
            <div className="flex items-end justify-between gap-2 flex-1 min-h-56 px-1">
              {monthlyRevenue.map((m) => {
                const heightPct = Math.max(4, Math.round((m.total / maxMonthlyRevenue) * 100));
                return (
                  <div
                    key={m.period}
                    title={`${formatMonthPeriod(m.period)}: ${m.total.toLocaleString()}`}
                    className="flex flex-col items-center justify-end h-full flex-1 min-w-0 group cursor-default"
                  >
                    <span className="text-[10px] text-muted font-dm mb-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.total.toLocaleString()}
                    </span>
                    <div
                      className="w-full max-w-7 rounded-t-md bg-linear-to-t from-gold/60 to-gold group-hover:to-gold/80 transition-colors"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[10px] text-muted font-dm mt-2 whitespace-nowrap">
                      {formatMonthPeriod(m.period, true)}
                    </span>
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
                    { value: 'Revenue', label: 'Revenue (SuperAdmin)' },
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
                Generated on the server for the selected report type, institution and date range —
                styled Excel or paginated PDF, downloaded straight from the backend.
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
              <PreviewRow label="Transactions" value={exportPreview && 'totalTransactions' in exportPreview.summary ? exportPreview.summary.totalTransactions : undefined} loading={exportPreviewLoading} />
              <PreviewRow label="Success amount" value={exportPreview && 'successAmount' in exportPreview.summary ? exportPreview.summary.successAmount : undefined} loading={exportPreviewLoading} />
              <PreviewRow label="Top-up amount" value={exportPreview && 'topUpAmount' in exportPreview.summary ? exportPreview.summary.topUpAmount : undefined} loading={exportPreviewLoading} />
            </div>
          )}
          {exportType === 'Revenue' && (
            <div className="space-y-2 text-sm">
              <PreviewRow label="Transactions" value={revenue?.summary.transactionCount} loading={loading} />
              <PreviewRow label="Top-up revenue" value={revenue?.summary.topUpAmount} loading={loading} />
              <PreviewRow label="Service fee revenue" value={revenue?.summary.serviceFeeAmount} loading={loading} />
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
