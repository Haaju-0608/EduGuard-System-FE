import React, { useState } from 'react';
import { FiDownload, FiBarChart2, FiCalendar, FiPieChart, FiInfo, FiTrendingUp, FiFolder } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('Attendance Log');
  const [department, setDepartment] = useState('All Departments');
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showToast, setShowToast] = useState(false);

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);
    setExportProgress(0);

    // Simulate export generation progress
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsExporting(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
          }, 350);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  // Mock report downloads list
  const recentDownloads = [
    { name: 'attendance_report_IT_may.xlsx', date: 'May 31, 2026', size: '154 KB', type: 'Excel' },
    { name: 'violation_summary_CS_midterm.pdf', date: 'May 24, 2026', size: '2.4 MB', type: 'PDF' },
    { name: 'credit_billing_invoice_Q2.pdf', date: 'April 15, 2026', size: '482 KB', type: 'PDF' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast popup */}
      {showToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-navy-mid border border-cyan/50 text-white-soft px-4 py-3 rounded-xl shadow-[0_8px_32px_rgba(6,182,212,0.15)] animate-fade-slide-in font-dm text-sm">
          <span>🟢</span>
          <span>Report exported and downloaded successfully!</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-syne font-extrabold text-2xl text-white-soft">Reports & Analytics</h1>
        <p className="text-muted font-dm text-sm mt-1">
          Generate system performance details, export logs, and analyze biometric patterns.
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Exams Monitored', value: '412', change: '+24 this month', color: 'text-blue-bright', icon: '📝' },
          { label: 'Violations Flagged', value: '86', change: '-12% vs last term', color: 'text-red', icon: '⚠️' },
          { label: 'Avg Attendance', value: '88.5%', change: '+1.4% improvement', color: 'text-green', icon: '✅' },
          { label: 'Exports Generated', value: '1,240', change: '8.4 GB total audit data', color: 'text-cyan', icon: '📤' },
        ].map((kpi, i) => (
          <div key={i} className="bg-navy-card border border-border rounded-[16px] p-4 font-dm hover:border-cyan/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted font-medium">{kpi.label}</span>
              <span className="text-sm">{kpi.icon}</span>
            </div>
            <p className={`font-syne font-extrabold text-xl leading-none ${kpi.color} mb-1.5`}>{kpi.value}</p>
            <p className="text-[10px] text-muted flex items-center gap-0.5">
              <FiTrendingUp className="text-[9px]" />
              <span>{kpi.change}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Attendance Rates Chart */}
        <div className="lg:col-span-3 bg-navy-card border border-border rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <FiBarChart2 className="text-blue-bright" />
              Attendance by Department
            </h3>
            <span className="text-xs text-muted font-dm">Last 4 Months</span>
          </div>

          {/* SVG Bar Chart */}
          <div className="w-full">
            <svg viewBox="0 0 350 140" className="w-full h-auto">
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-blue-bright)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--color-blue-bright)" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[30, 60, 90].map((y) => (
                <line key={y} x1="30" y1={y} x2="330" y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="3,3" />
              ))}

              {/* Bars */}
              {/* IT */}
              <rect x="55" y="20" width="16" height="90" fill="url(#blueGrad)" rx="2" />
              <text x="63" y="15" textAnchor="middle" fill="var(--color-blue-bright)" fontSize="7" fontWeight="bold">92%</text>
              
              {/* CS */}
              <rect x="125" y="32" width="16" height="78" fill="url(#cyanGrad)" rx="2" />
              <text x="133" y="27" textAnchor="middle" fill="var(--color-cyan)" fontSize="7" fontWeight="bold">88%</text>

              {/* Math */}
              <rect x="195" y="44" width="16" height="66" fill="url(#blueGrad)" rx="2" />
              <text x="203" y="39" textAnchor="middle" fill="var(--color-blue-bright)" fontSize="7" fontWeight="bold">84%</text>

              {/* English */}
              <rect x="265" y="28" width="16" height="82" fill="url(#cyanGrad)" rx="2" />
              <text x="273" y="23" textAnchor="middle" fill="var(--color-cyan)" fontSize="7" fontWeight="bold">90%</text>

              {/* X Axis Labels */}
              {['IT Department', 'CS Department', 'Math', 'English'].map((dept, i) => (
                <text key={i} x={63 + i * 70} y="122" textAnchor="middle" fill="var(--color-muted)" fontSize="7.5" fontFamily="DM Sans">
                  {dept}
                </text>
              ))}

              <line x1="30" y1="110" x2="330" y2="110" stroke="var(--color-border)" strokeWidth="1" />
            </svg>
          </div>
        </div>

        {/* Violations Distribution Donut Chart */}
        <div className="lg:col-span-2 bg-navy-card border border-border rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <FiPieChart className="text-red" />
              Violation Types
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* SVG Donut */}
            <div className="relative w-[110px] h-[110px]">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                
                {/* Segment 1: Looking away (45%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--color-red)" strokeWidth="3"
                        strokeDasharray="45 100" strokeDashoffset="0" />
                
                {/* Segment 2: Phone usage (30%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--color-gold)" strokeWidth="3"
                        strokeDasharray="30 100" strokeDashoffset="-45" />

                {/* Segment 3: Absent/Leaving (25%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--color-cyan)" strokeWidth="3"
                        strokeDasharray="25 100" strokeDashoffset="-75" />
              </svg>
              {/* Inner Circle Label */}
              <div className="absolute inset-0 grid place-items-center">
                <span className="font-syne font-extrabold text-sm text-white-soft">86 Total</span>
              </div>
            </div>

            {/* Labels Legend */}
            <div className="flex-1 flex flex-col gap-2 text-[11px] font-dm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red" />
                <span className="text-white-soft font-medium">Looking away (45%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gold" />
                <span className="text-white-soft font-medium">Phone use (30%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan" />
                <span className="text-white-soft font-medium">Absent/Left (25%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Center: Export Forms + Downloads list */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Export Form */}
        <div className="lg:col-span-3 bg-navy-card border border-border rounded-[16px] p-5">
          <h3 className="font-syne font-bold text-white-soft text-base mb-4 flex items-center gap-2">
            <FiDownload className="text-cyan" />
            Export Audit Data
          </h3>

          <form onSubmit={handleExport} className="space-y-4 font-dm text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Type */}
              <div>
                <label className="block text-muted font-medium mb-1.5">Report Type</label>
                <CustomSelect
                  value={reportType}
                  onChange={setReportType}
                  options={['Attendance Log','Proctoring Violations','Credit Utilization'].map((v) => ({value:v,label:v}))}
                  className="w-full"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-muted font-medium mb-1.5">Department</label>
                <CustomSelect
                  value={department}
                  onChange={setDepartment}
                  options={['All Departments','IT','CS','Math','English'].map((v) => ({value:v,label:v}))}
                  className="w-full"
                />
              </div>

              {/* Date range */}
              <div>
                <label className="block text-muted font-medium mb-1.5">Date Range</label>
                <CustomSelect
                  value={dateRange}
                  onChange={setDateRange}
                  options={['Last 7 Days','Last 30 Days','Last 90 Days','Custom Range'].map((v) => ({value:v,label:v}))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Simulated progress loader */}
            {isExporting ? (
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1.5 font-mono text-xs text-muted">
                  <span>Generating {reportType} report...</span>
                  <span>{exportProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-navy rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-blue to-cyan transition-all duration-150"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-navy/40 border border-border/60 rounded-xl p-3 text-xs text-muted">
                <FiInfo className="text-cyan text-sm flex-shrink-0 mt-0.5" />
                <p>
                  Export reports compile comprehensive attendance check-in metrics, biometric comparison matching logs, and proctored violation records suitable for university auditing.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isExporting}
                className="flex items-center justify-center gap-2 bg-linear-to-r from-blue to-blue-bright text-white font-semibold py-2.5 px-5 rounded-xl cursor-pointer hover:brightness-110 shadow-lg transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                <FiDownload className="text-sm" />
                <span>{isExporting ? 'Compiling data...' : 'Generate and Download'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Recent Downloads list */}
        <div className="lg:col-span-2 bg-navy-card border border-border rounded-[16px] p-5">
          <h3 className="font-syne font-bold text-white-soft text-base mb-4 flex items-center gap-2">
            <FiFolder className="text-gold" />
            Recent Exports
          </h3>

          <div className="flex flex-col gap-2 font-dm">
            {recentDownloads.map((dl, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-navy/40 border border-border/40 hover:bg-navy-mid transition-colors cursor-pointer group"
              >
                <div className="min-w-0">
                  <p className="text-xs text-white-soft font-semibold truncate group-hover:text-cyan transition-colors">
                    {dl.name}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">{dl.date} • {dl.size}</p>
                </div>
                <span className="text-[10px] font-semibold text-cyan bg-cyan/10 px-2 py-0.5 rounded-sm uppercase tracking-wide border border-cyan/20">
                  {dl.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
