import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiAlertTriangle, FiEye, FiSlash, FiRefreshCw,
  FiVideo, FiUser, FiClock, FiChevronLeft, FiChevronRight, FiX, FiCheckCircle,
} from 'react-icons/fi';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  fetchViolationLogs,
  fetchParticipationById,
  fetchExamSlotById,
  disqualifyParticipation,
  reviewViolationLog,
} from '../../../services/lecturerApi';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import type { ApiViolationLog, ApiExamParticipation, ApiExamSlot } from '../../../types/api';

interface ResourceChangedPayload {
  resource: string;
  action: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

const VIOLATION_LABELS: Record<string, { label: string; icon: string }> = {
  GazeDiversion:  { label: 'Gaze Diversion',  icon: '👁' },
  MultipleFaces:  { label: 'Multiple Faces',   icon: '👥' },
  Absence:        { label: 'Absence',          icon: '🚫' },
  Impersonation:  { label: 'Impersonation',    icon: '🎭' },
};

function getViolationLabel(type: string) {
  return VIOLATION_LABELS[type] ?? { label: type, icon: '⚠️' };
}

function severityConfig(severity: string) {
  if (severity === 'Severe')
    return { cls: 'text-red bg-red/10 border-red/30', dot: 'bg-red', label: 'Severe' };
  return { cls: 'text-gold bg-gold/10 border-gold/30', dot: 'bg-gold', label: 'Warning' };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Evidence Modal ───────────────────────────────────────────────────────────

interface EvidenceModalProps {
  log: ApiViolationLog;
  participation: ApiExamParticipation | null | undefined;
  examName: string | null;
  onClose: () => void;
  onDisqualify: (log: ApiViolationLog) => void;
  disqualifying: boolean;
  alreadyDisqualified: boolean;
  isReviewed: boolean;
  reviewedByName: string | null;
}

function EvidenceModal({
  log, participation, examName, onClose, onDisqualify,
  disqualifying, alreadyDisqualified, isReviewed, reviewedByName,
}: EvidenceModalProps) {
  const viol = getViolationLabel(log.violationType);
  const sev = severityConfig(log.severity);
  const studentName = participation?.student?.fullName ?? participation?.student?.email ?? null;
  const isVideo = log.evidencePath?.match(/\.(webm|mp4|mov|avi)(\?|$)/i) != null
    || (log.evidencePath?.startsWith('http') && !log.evidencePath?.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i));
  const isImage = log.evidencePath?.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i) != null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-navy-card border border-border rounded-t-[20px] sm:rounded-[20px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{viol.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-syne font-bold text-white-soft">{viol.label}</h2>
                {isReviewed && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green bg-green/10 border border-green/30 px-2 py-0.5 rounded-full">
                    <FiCheckCircle size={10} /> Reviewed
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">Violation Evidence Review</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted hover:text-white-soft hover:bg-white/5 transition-colors cursor-pointer">
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar min-h-0">
          {/* Evidence */}
          <div className="bg-navy border border-border rounded-xl overflow-hidden">
            {log.evidencePath ? (
              isVideo ? (
                <video
                  src={log.evidencePath}
                  controls
                  className="w-full max-h-64 object-contain bg-black"
                />
              ) : isImage ? (
                <img src={log.evidencePath} alt="Evidence" className="w-full max-h-64 object-contain bg-black" />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <FiVideo size={32} className="text-muted" />
                  <p className="text-xs text-muted break-all px-4 text-center">{log.evidencePath}</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <FiVideo size={32} className="text-muted" />
                <p className="text-sm text-muted">No evidence recorded</p>
              </div>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={<FiUser size={14} />} label="Student" value={studentName ?? `ID: …${log.participationId.slice(-8)}`} />
            <InfoRow icon={<span className="text-xs">📝</span>} label="Exam" value={examName ?? '—'} />
            <InfoRow icon={<span className="text-xs">{viol.icon}</span>} label="Violation Type" value={viol.label} />
            <InfoRow
              icon={<FiAlertTriangle size={14} />}
              label="Severity"
              value={
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sev.cls}`}>
                  {sev.label}
                </span>
              }
            />
            <InfoRow
              icon={<span className="text-xs">🤖</span>}
              label="AI Confidence"
              value={log.aiConfidence != null && log.aiConfidence > 0 ? `${Math.round(log.aiConfidence * 100)}%` : '—'}
            />
            <InfoRow icon={<FiClock size={14} />} label="Recorded At" value={fmtTime(log.recordedAt ?? log.createdAt)} />
            <InfoRow
              icon={<FiCheckCircle size={14} className={isReviewed ? 'text-green' : 'text-muted'} />}
              label="Reviewed By"
              value={
                isReviewed
                  ? <span className="text-green">{reviewedByName ?? 'You'}</span>
                  : <span className="text-muted">Not reviewed</span>
              }
            />
          </div>
        </div>

        {/* Footer */}
        {(() => {
          const status = participation?.status;
          const canDisqualify = !alreadyDisqualified && status === 'Joined';
          const statusLabel =
            alreadyDisqualified ? '✅ Already Disqualified' :
            status === 'Submitted' ? '📋 Student Already Submitted' :
            status === 'Left'      ? '🚪 Student Left The Exam' :
            status === 'Absent'    ? '❌ Student Was Absent' :
            null;
          return (
            <div className="flex gap-3 p-5 border-t border-border shrink-0">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-blue/40 hover:text-white-soft transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => onDisqualify(log)}
                disabled={disqualifying || !canDisqualify}
                title={!canDisqualify && !alreadyDisqualified ? 'Disqualify only works while the student is actively in the exam (status: Joined)' : undefined}
                className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-semibold border border-red hover:bg-red/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {disqualifying ? (
                  <><span className="animate-spin">⏳</span> Disqualifying…</>
                ) : statusLabel ? statusLabel : (
                  <><FiSlash size={14} /> Disqualify Student</>
                )}
              </button>
            </div>
          );
        })()}
      </div>
    </div>,
    document.body,
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-navy/40 border border-border/40 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm text-white-soft font-medium">{value}</div>
    </div>
  );
}

// ─── Confirm Disqualify Dialog ────────────────────────────────────────────────

interface ConfirmDialogProps {
  log: ApiViolationLog;
  studentName: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

function ConfirmDialog({ log, studentName, onConfirm, onCancel }: ConfirmDialogProps) {
  const viol = getViolationLabel(log.violationType);
  const defaultReason = `${viol.label} violation detected by AI proctoring`;
  const [reason, setReason] = useState(defaultReason);

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-navy-card border border-red/40 rounded-[20px] w-full max-w-sm p-6 shadow-2xl">
        <div className="text-center mb-5">
          <div className="text-4xl mb-3">⛔</div>
          <h3 className="font-syne font-bold text-white-soft text-lg">Disqualify Student?</h3>
          <p className="text-muted text-sm mt-2">
            This will set the participation status to <span className="text-red font-bold">Disqualified</span>.
            The student cannot retake the exam.
          </p>
        </div>
        <div className="bg-navy border border-border rounded-xl p-3 mb-4 text-sm text-muted space-y-1">
          <p><span className="text-white-soft font-medium">Student:</span> {studentName ?? `…${log.participationId.slice(-8)}`}</p>
          <p><span className="text-white-soft font-medium">Violation:</span> {viol.icon} {viol.label}</p>
        </div>
        <div className="mb-5">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wide block mb-1.5">
            Disqualification Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full bg-navy border border-border rounded-xl px-3 py-2 text-sm text-white-soft resize-none outline-none focus:border-blue-bright/40 transition-colors placeholder:text-muted"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-blue/40 hover:text-white-soft transition-all cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim() || defaultReason)}
            className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-bold border border-red hover:bg-red/80 transition-all cursor-pointer"
          >
            Disqualify
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ViolationReviewPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'Severe' | 'Warning'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // keyed by participationId — undefined = not loaded yet, null = failed
  const [participationCache, setParticipationCache] = useState<Record<string, ApiExamParticipation | null>>({});
  // keyed by examSlotId
  const [examSlotCache, setExamSlotCache] = useState<Record<string, ApiExamSlot | null>>({});
  const [disqualifiedIds, setDisqualifiedIds] = useState<Set<string>>(new Set());
  const [disqualifyingId, setDisqualifyingId] = useState<string | null>(null);

  // log IDs reviewed in this session (local optimistic state)
  const [reviewedLogIds, setReviewedLogIds] = useState<Set<string>>(new Set());

  const [selectedLog, setSelectedLog] = useState<ApiViolationLog | null>(null);
  const [confirmLog, setConfirmLog] = useState<{ log: ApiViolationLog } | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () => fetchViolationLogs({ page, pageSize: PAGE_SIZE }),
    [page],
  );

  // Realtime: BE bắn ResourceChanged("violations") tới DashboardHub group của lecturer ngay khi AI phát hiện vi phạm mới
  const dashboardHub = useHubConnection(HubRoute.Dashboard, !!user?.id);
  useHubGroup(HubRoute.Dashboard, 'JoinLecturerDashboard', user?.id ? [user.id] : null);
  useHubEvent<ResourceChangedPayload>(dashboardHub, 'ResourceChanged', (payload) => {
    if (payload.resource !== 'violations') return;
    toast.warning('New violation detected', 'AI proctoring flagged a new violation — list refreshed.');
    reload();
  });

  const logs = data?.items ?? [];
  const pagination = data?.pagination;

  // Filtered locally
  const filtered = logs.filter((l) => {
    if (severityFilter !== 'all' && l.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && l.violationType !== typeFilter) return false;
    return true;
  });

  // Load participation info for visible logs
  useEffect(() => {
    const missing = filtered
      .map((l) => l.participationId)
      .filter((id) => !(id in participationCache));
    if (missing.length === 0) return;
    const uniq = [...new Set(missing)];
    uniq.forEach(async (id) => {
      const p = await fetchParticipationById(id);
      setParticipationCache((prev) => ({ ...prev, [id]: p }));
      // Load exam slot ngay sau khi có examSlotId
      if (p?.examSlotId) {
        setExamSlotCache((prev) => {
          if (p.examSlotId in prev) return prev;
          fetchExamSlotById(p.examSlotId).then((slot) => {
            setExamSlotCache((cur) => ({ ...cur, [p.examSlotId]: slot }));
          }).catch(() => undefined);
          return { ...prev, [p.examSlotId]: null };
        });
      }
    });
  }, [filtered, participationCache]);

  const allTypes = [...new Set(logs.map((l) => l.violationType).filter(Boolean))];

  const severeCount = logs.filter((l) => l.severity === 'Severe').length;
  const warningCount = logs.filter((l) => l.severity === 'Warning').length;
  const reviewedCount = logs.filter((l) => l.reviewedBy != null || reviewedLogIds.has(l.id)).length;

  // Open evidence modal and auto-mark as reviewed
  const handleOpenEvidence = useCallback(async (log: ApiViolationLog) => {
    setSelectedLog(log);
    const alreadyReviewed = log.reviewedBy != null || reviewedLogIds.has(log.id);
    if (!alreadyReviewed && user?.id) {
      try {
        await reviewViolationLog(log.id, user.id);
        setReviewedLogIds((prev) => new Set([...prev, log.id]));
      } catch {
        // silently ignore — evidence is still shown
      }
    }
  }, [reviewedLogIds, user?.id]);

  const handleDisqualify = useCallback((log: ApiViolationLog) => {
    setSelectedLog(null);
    setConfirmLog({ log });
  }, []);

  const handleConfirmDisqualify = useCallback(async (reason: string) => {
    if (!confirmLog) return;
    const { log } = confirmLog;
    setConfirmLog(null);
    setDisqualifyingId(log.participationId);
    try {
      await disqualifyParticipation(log.participationId, reason);
      setDisqualifiedIds((prev) => new Set([...prev, log.participationId]));
      toast.success('Student disqualified', 'Participation has been marked as Disqualified.');
    } catch {
      toast.error('Failed', 'Could not disqualify the student. Please try again.');
    } finally {
      setDisqualifyingId(null);
    }
  }, [confirmLog, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Violation Evidence Review</h1>
          <p className="text-muted text-sm mt-1">
            Review AI-detected violations and decide on exam disqualification.
          </p>
        </div>
        <button
          onClick={() => { setPage(1); reload(); }}
          disabled={loading}
          className="shrink-0 p-2.5 rounded-xl border border-border text-muted hover:border-blue/40 hover:text-blue-bright transition-colors cursor-pointer disabled:opacity-50"
        >
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: pagination?.totalItems ?? logs.length, color: 'text-blue-bright' },
          { label: 'Severe',   value: severeCount,   color: 'text-red' },
          { label: 'Warning',  value: warningCount,  color: 'text-gold' },
          { label: 'Reviewed', value: reviewedCount, color: 'text-green' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'Severe', 'Warning'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
              severityFilter === s
                ? s === 'Severe' ? 'bg-red text-white border-red'
                  : s === 'Warning' ? 'bg-gold text-navy border-gold'
                  : 'bg-blue text-white border-blue'
                : 'bg-transparent text-muted border-border hover:border-blue/40'
            }`}
          >
            {s === 'all' ? 'All Severity' : s}
          </button>
        ))}
        <div className="w-px h-8 bg-border self-center" />
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
            typeFilter === 'all' ? 'bg-blue text-white border-blue' : 'bg-transparent text-muted border-border hover:border-blue/40'
          }`}
        >
          All Types
        </button>
        {allTypes.map((t) => {
          const v = getViolationLabel(t);
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                typeFilter === t ? 'bg-blue text-white border-blue' : 'bg-transparent text-muted border-border hover:border-blue/40'
              }`}
            >
              {v.icon} {v.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-navy-card border border-border rounded-2xl h-16 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-red/30 rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-red text-sm mb-3">{error}</p>
          <button onClick={reload} className="text-xs text-blue-bright underline cursor-pointer">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-muted text-sm">No violations found.</p>
        </div>
      ) : (
        <>
          <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_auto] gap-4 px-5 py-3 border-b border-border text-[10px] font-bold text-muted uppercase tracking-wider">
              <span>Student</span>
              <span>Violation Type</span>
              <span>Severity</span>
              <span>AI Score</span>
              <span>Recorded At</span>
              <span className="text-right">Actions</span>
            </div>

            {filtered.map((log, idx) => {
              const viol = getViolationLabel(log.violationType);
              const sev = severityConfig(log.severity);
              const p = participationCache[log.participationId];
              const studentName = p?.student?.fullName ?? p?.student?.email ?? null;
              const isDisqualified = disqualifiedIds.has(log.participationId) || p?.status === 'Disqualified';
              const isDisqualifying = disqualifyingId === log.participationId;
              const canDisqualify = !isDisqualified && !isDisqualifying && p?.status === 'Joined';
              const disqualifyTitle =
                isDisqualifying              ? 'Processing…' :
                isDisqualified               ? 'Already disqualified' :
                p === undefined              ? 'Loading participation…' :
                p === null                   ? 'Unable to load participation' :
                p.status === 'Submitted'     ? 'Student already submitted — cannot disqualify' :
                p.status === 'Left'          ? 'Student left the exam — cannot disqualify' :
                p.status === 'Absent'        ? 'Student was absent — cannot disqualify' :
                                               'Disqualify student';
              const isReviewed = log.reviewedBy != null || reviewedLogIds.has(log.id);
              const examSlot = p?.examSlotId ? examSlotCache[p.examSlotId] : null;
              const examName = examSlot?.examName ?? null;

              return (
                <div
                  key={log.id}
                  className={`grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_auto] gap-4 px-5 py-3.5 items-center transition-colors hover:bg-white/2 ${
                    idx !== filtered.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                >
                  {/* Student */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-blue/20 border border-blue/30 flex items-center justify-center shrink-0">
                      <FiUser size={12} className="text-blue-bright" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-white-soft truncate">
                          {studentName ?? (p === undefined ? 'Loading…' : `Student …${log.participationId.slice(-6)}`)}
                        </p>
                        {isReviewed && (
                          <FiCheckCircle size={12} className="text-green shrink-0" title="Reviewed" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted font-mono truncate">
                        {log.participationId.slice(0, 8)}…
                      </p>
                      {examName && (
                        <p className="text-[10px] text-blue-bright truncate mt-0.5">
                          📝 {examName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Type */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{viol.icon}</span>
                    <span className="text-sm text-white-soft">{viol.label}</span>
                  </div>

                  {/* Severity */}
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border w-fit ${sev.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                    {sev.label}
                  </span>

                  {/* AI Score */}
                  <div>
                    {log.aiConfidence != null && log.aiConfidence > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-navy rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-bright rounded-full"
                            style={{ width: `${Math.round(log.aiConfidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-white-soft font-mono shrink-0">
                          {Math.round(log.aiConfidence * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <FiClock size={11} />
                    {fmtTime(log.recordedAt ?? log.createdAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => void handleOpenEvidence(log)}
                      title="View Evidence"
                      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                        isReviewed
                          ? 'border-green/30 text-green hover:bg-green/10'
                          : 'border-border text-muted hover:border-blue/40 hover:text-blue-bright'
                      }`}
                    >
                      <FiEye size={14} />
                    </button>
                    <button
                      onClick={() => handleDisqualify(log)}
                      disabled={!canDisqualify}
                      title={disqualifyTitle}
                      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                        !canDisqualify
                          ? 'border-border text-muted opacity-40 cursor-not-allowed'
                          : 'border-red/30 text-red hover:bg-red/10 hover:border-red/60'
                      }`}
                    >
                      {isDisqualifying ? (
                        <span className="text-xs animate-spin inline-block">⏳</span>
                      ) : (
                        <FiSlash size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                Page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} violations
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-xl border border-border text-muted hover:border-blue/40 hover:text-blue-bright transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-2 rounded-xl border border-border text-muted hover:border-blue/40 hover:text-blue-bright transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Evidence Modal */}
      {selectedLog && (
        <EvidenceModal
          log={selectedLog}
          participation={participationCache[selectedLog.participationId]}
          examName={(() => {
            const p = participationCache[selectedLog.participationId];
            return p?.examSlotId ? (examSlotCache[p.examSlotId]?.examName ?? null) : null;
          })()}
          onClose={() => setSelectedLog(null)}
          onDisqualify={handleDisqualify}
          disqualifying={disqualifyingId === selectedLog.participationId}
          alreadyDisqualified={
            disqualifiedIds.has(selectedLog.participationId) ||
            participationCache[selectedLog.participationId]?.status === 'Disqualified'
          }
          isReviewed={selectedLog.reviewedBy != null || reviewedLogIds.has(selectedLog.id)}
          reviewedByName={user?.name ?? user?.email ?? null}
        />
      )}

      {/* Confirm Disqualify Dialog */}
      {confirmLog && (
        <ConfirmDialog
          log={confirmLog.log}
          studentName={
            participationCache[confirmLog.log.participationId]?.student?.fullName ??
            participationCache[confirmLog.log.participationId]?.student?.email ??
            null
          }
          onConfirm={(reason) => void handleConfirmDisqualify(reason)}
          onCancel={() => setConfirmLog(null)}
        />
      )}
    </div>
  );
}
