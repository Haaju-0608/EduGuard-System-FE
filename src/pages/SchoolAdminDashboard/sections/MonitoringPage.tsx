import React, { useState } from 'react';
import { FiActivity, FiCamera, FiClock, FiRefreshCw, FiUsers, FiVideo } from 'react-icons/fi';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchAttendanceSessions } from '../../../services/lecturerApi';
import { fetchExamSlots } from '../../../services/schoolAdminApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import type { ApiAttendanceSession } from '../../../types/api';
import type { ExamSlot } from '../../../types/lecturer';

type TabKey = 'attendance' | 'exam';

const LIVE_RESOURCES = new Set(['attendance-sessions', 'attendance-records', 'exam-slots', 'exam-participations']);

interface ResourceChangedPayload {
  resource: string;
  action: string;
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? '';
  const config =
    s === 'active' || s === 'open' || s === 'ongoing'
      ? { label: 'Live', className: 'text-green bg-green/10 border-green/25 animate-pulse' }
      : s === 'closed' || s === 'completed' || s === 'ended'
      ? { label: 'Ended', className: 'text-muted bg-white/5 border-border' }
      : { label: status ?? 'Unknown', className: 'text-gold bg-gold/10 border-gold/25' };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${config.className}`}>
      {config.label}
    </span>
  );
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');

  const { data: attendanceRes, loading: loadingA, reload: reloadA } = useAsyncData(
    () => fetchAttendanceSessions({ page: 1, pageSize: 50 }),
    [],
  );
  const { data: examRes, loading: loadingE, reload: reloadE } = useAsyncData(
    () => fetchExamSlots({ page: 1, pageSize: 50 }),
    [],
  );

  // Realtime: tự refresh khi BE báo có attendance session/exam slot/record mới trong institution
  const institutionId = user?.institutionId ?? null;
  const dashboardHub = useHubConnection(HubRoute.Dashboard, !!institutionId);
  useHubGroup(HubRoute.Dashboard, 'JoinInstitutionDashboard', institutionId ? [institutionId] : null);
  useHubEvent<ResourceChangedPayload>(dashboardHub, 'ResourceChanged', (payload) => {
    if (!LIVE_RESOURCES.has(payload.resource)) return;
    reloadA();
    reloadE();
  });

  const attendanceSessions: ApiAttendanceSession[] = attendanceRes?.items ?? [];
  const examSlots: ExamSlot[] = examRes?.items ?? [];

  const liveSessions = attendanceSessions.filter(
    (s) => !s.endTime && s.status?.toLowerCase() !== 'closed',
  ).length;
  const liveExams = examSlots.filter((e) => e.status === 'ongoing').length;

  function handleReload() {
    reloadA();
    reloadE();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne font-extrabold text-[1.6rem] text-white-soft">Monitoring</h1>
          <p className="text-muted text-sm mt-1">Live attendance sessions and exam proctoring</p>
        </div>
        <button
          onClick={handleReload}
          disabled={loadingA || loadingE}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
        >
          <FiRefreshCw className={(loadingA || loadingE) ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Live Sessions', value: loadingA ? '…' : String(liveSessions), icon: <FiCamera />, color: 'text-green' },
          { label: 'Live Exams', value: loadingE ? '…' : String(liveExams), icon: <FiVideo />, color: 'text-blue-bright' },
          { label: 'Total Sessions', value: loadingA ? '…' : String(attendanceSessions.length), icon: <FiActivity />, color: 'text-cyan' },
          { label: 'Total Exams', value: loadingE ? '…' : String(examSlots.length), icon: <FiUsers />, color: 'text-gold' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-navy-card border border-border rounded-2xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-white/5 grid place-items-center text-lg ${kpi.color}`}>
              {kpi.icon}
            </div>
            <div>
              <p className={`font-syne font-extrabold text-xl ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-muted">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-navy-card border border-border rounded-xl w-fit">
        {([['attendance', 'Attendance Sessions'], ['exam', 'Exam Sessions']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all border-none ${
              activeTab === key ? 'bg-blue text-white' : 'bg-transparent text-muted hover:text-white-soft'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="bg-navy-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold text-white-soft">Attendance Sessions</p>
            <span className="text-[11px] text-muted">{attendanceSessions.length} sessions</span>
          </div>
          {loadingA ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-3 h-3 rounded-full bg-white/5 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
                    <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/3" />
                  </div>
                  <div className="h-6 w-14 bg-white/5 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : attendanceSessions.length === 0 ? (
            <div className="py-16 text-center text-muted text-sm">No attendance sessions found.</div>
          ) : (
            <div className="divide-y divide-border">
              {attendanceSessions.map((session) => (
                <div key={session.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy/40 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${!session.endTime ? 'bg-green animate-pulse' : 'bg-muted'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white-soft/90 font-medium truncate">
                      {(session.class as { name?: string } | undefined)?.name ?? session.classId.slice(0, 12)}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5 flex items-center gap-2">
                      <FiClock className="text-[10px]" />
                      Started: {formatDateTime(session.startTime)}
                      {session.endTime && (
                        <span className="ml-1">· Ended: {formatDateTime(session.endTime)}</span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={session.status ?? (session.endTime ? 'Ended' : 'Active')} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exam Tab */}
      {activeTab === 'exam' && (
        <div className="bg-navy-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold text-white-soft">Exam Sessions</p>
            <span className="text-[11px] text-muted">{examSlots.length} exams</span>
          </div>
          {loadingE ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-3 h-3 rounded-full bg-white/5 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
                    <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/3" />
                  </div>
                  <div className="h-6 w-14 bg-white/5 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : examSlots.length === 0 ? (
            <div className="py-16 text-center text-muted text-sm">No exam sessions found.</div>
          ) : (
            <div className="divide-y divide-border">
              {examSlots.map((exam) => (
                <div key={exam.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy/40 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${exam.status === 'ongoing' ? 'bg-blue-bright animate-pulse' : 'bg-muted'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white-soft/90 font-medium truncate">{exam.examName}</p>
                    <p className="text-[11px] text-muted mt-0.5 flex items-center gap-2">
                      <FiClock className="text-[10px]" />
                      {formatDateTime(exam.startTime)} – {formatDateTime(exam.endTime)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={exam.status ?? 'Unknown'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
