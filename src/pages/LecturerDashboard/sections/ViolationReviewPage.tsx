import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { patchWebmDuration } from '../../../ai/services/webmDurationFix';
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
  resolveEvidenceUrl,
} from '../../../services/lecturerApi';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import { getViolationLabel } from '../../../utils/violationLabels';
import type { ApiViolationLog, ApiExamParticipation, ApiExamSlot } from '../../../types/api';

interface ResourceChangedPayload {
  resource: string;
  action: string;
}

interface ParticipationGroup {
  participationId: string;
  logs: ApiViolationLog[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

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

// ─── Evidence resolving ─────────────────────────────────────────────────────
// `log.evidencePath` từ `/api/violation-logs` chỉ là raw object path trong bucket Supabase
// (vd "FPT/TEST_PAL/.../xxx.webm"), KHÔNG phải URL — đã verify qua Network tab: trỏ <video src>
// hay fetch() thẳng vào nó khiến trình duyệt hiểu nhầm là URL tương đối, resolve về chính domain
// của app (vd "localhost:5173/lecture/FPT/...") thay vì Supabase, luôn nhận về response rỗng/sai.
// Phải đổi qua POST /api/storage/signed-url (resolveEvidenceUrl) lấy URL thật trước khi dùng.
function useResolvedEvidenceUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      setError(false);
      return;
    }
    let cancelled = false;
    setUrl(null);
    setError(false);

    resolveEvidenceUrl(path)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch((err) => {
        console.warn('[useResolvedEvidenceUrl] Failed to resolve signed URL:', err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { url, error };
}

// ─── Evidence Video ───────────────────────────────────────────────────────────
// Tải cả file thành blob rồi phát qua object URL thay vì trỏ <video src> thẳng tới URL đã resolve.
// Lý do thật sự (đã verify bằng ffprobe + tự parse EBML trên 1 file thật): Chrome's MediaRecorder
// CÓ ghi Duration vào header .webm khi assemble Blob, nhưng ghi giá trị SAI — chỉ "1" đơn vị
// TimecodeScale (1ms) dù data giải mã ra đủ 100% (150 frame ~10s), nên <video> đọc duration ra
// 0:00 và bấm Play không chạy, dù file hoàn toàn không hỏng. EvidenceRecorder.ts giờ đã vá lỗi
// này TRƯỚC khi upload cho các clip ghi MỚI, nhưng các clip cũ đã nằm sẵn trên Supabase từ trước
// vẫn còn lỗi header — nên ở đây vá lại lần nữa bằng patchWebmDuration mỗi khi xem (dùng đúng
// ~10s là thời lượng cố định của mọi clip evidence theo thiết kế: DEFAULT_PRE_EVENT_MS +
// DEFAULT_POST_VIOLATION_MS trong EvidenceRecorder.ts).
const EVIDENCE_CLIP_DURATION_MS = 10_000;

function EvidenceVideo({ path }: { path: string }) {
  const { url: signedUrl, error: resolveError } = useResolvedEvidenceUrl(path);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!signedUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setBlobUrl(null);
    setError(false);

    fetch(signedUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => patchWebmDuration(blob, EVIDENCE_CLIP_DURATION_MS).catch((err) => {
        console.warn('[EvidenceVideo] patchWebmDuration failed, falling back to raw blob:', err);
        return blob;
      }))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [signedUrl]);

  if (error || resolveError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <FiVideo size={32} className="text-muted" />
        <p className="text-xs text-muted text-center px-4">Could not load the evidence video.</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <span className="w-6 h-6 border-2 border-blue-bright/30 border-t-blue-bright rounded-full animate-spin" />
        <p className="text-xs text-muted">Loading video…</p>
      </div>
    );
  }

  return <video src={blobUrl} controls className="w-full max-h-64 object-contain bg-black" />;
}

// ─── Evidence Image ───────────────────────────────────────────────────────────

function EvidenceImage({ path }: { path: string }) {
  const { url, error } = useResolvedEvidenceUrl(path);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <FiVideo size={32} className="text-muted" />
        <p className="text-xs text-muted text-center px-4">Could not load the evidence image.</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <span className="w-6 h-6 border-2 border-blue-bright/30 border-t-blue-bright rounded-full animate-spin" />
        <p className="text-xs text-muted">Loading image…</p>
      </div>
    );
  }

  return <img src={url} alt="Evidence" className="w-full max-h-64 object-contain bg-black" />;
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
    <div className="fixed inset-0 z-160 flex items-end sm:items-center justify-center sm:p-6 overflow-y-auto" onClick={onClose}>
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
                <EvidenceVideo path={log.evidencePath} />
              ) : isImage ? (
                <EvidenceImage path={log.evidencePath} />
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

// ─── Participation Detail Modal (1 exam attempt = 1 card → list of its violations) ────

interface ParticipationDetailModalProps {
  group: ParticipationGroup;
  participation: ApiExamParticipation | null | undefined;
  examName: string | null;
  reviewedLogIds: Set<string>;
  onClose: () => void;
  onViewLog: (log: ApiViolationLog) => void;
  onDisqualify: () => void;
  disqualifying: boolean;
  alreadyDisqualified: boolean;
}

function ParticipationDetailModal({
  group, participation, examName, reviewedLogIds,
  onClose, onViewLog, onDisqualify, disqualifying, alreadyDisqualified,
}: ParticipationDetailModalProps) {
  const studentName = participation?.student?.fullName ?? participation?.student?.email ?? null;
  const status = participation?.status;
  const canDisqualify = !alreadyDisqualified && status === 'Joined';
  const statusLabel =
    alreadyDisqualified ? '✅ Already Disqualified' :
    status === 'Submitted' ? '📋 Student Already Submitted' :
    status === 'Left'      ? '🚪 Student Left The Exam' :
    status === 'Absent'    ? '❌ Student Was Absent' :
    null;

  return createPortal(
    <div className="fixed inset-0 z-150 flex items-end sm:items-center justify-center sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-navy-card border border-border rounded-t-[20px] sm:rounded-[20px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue/20 border border-blue/30 flex items-center justify-center shrink-0">
              <FiUser size={16} className="text-blue-bright" />
            </div>
            <div className="min-w-0">
              <h2 className="font-syne font-bold text-white-soft truncate">
                {studentName ?? `Student …${group.participationId.slice(-6)}`}
              </h2>
              <p className="text-xs text-muted truncate">
                {examName ?? '—'} · {group.logs.length} violation{group.logs.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted hover:text-white-soft hover:bg-white/5 transition-colors cursor-pointer shrink-0">
            <FiX size={18} />
          </button>
        </div>

        {/* Violations list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-0">
          {group.logs.map((log) => {
            const viol = getViolationLabel(log.violationType);
            const sev = severityConfig(log.severity);
            const isReviewed = log.reviewedBy != null || reviewedLogIds.has(log.id);
            return (
              <button
                key={log.id}
                onClick={() => onViewLog(log)}
                className="w-full text-left flex items-center gap-3 bg-navy/40 border border-border/40 hover:border-blue/40 rounded-xl px-3.5 py-3 transition-colors cursor-pointer"
              >
                <span className="text-xl shrink-0">{viol.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-white-soft font-medium">{viol.label}</p>
                    {isReviewed && <FiCheckCircle size={11} className="text-green shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                    <FiClock size={10} /> {fmtTime(log.recordedAt ?? log.createdAt)}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${sev.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                  {sev.label}
                </span>
                <FiEye size={14} className="text-muted shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-blue/40 hover:text-white-soft transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={onDisqualify}
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
      </div>
    </div>,
    document.body,
  );
}

// ─── Confirm Disqualify Dialog ────────────────────────────────────────────────

interface ConfirmDialogProps {
  log: ApiViolationLog;
  violationCount: number;
  studentName: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

function ConfirmDialog({ log, violationCount, studentName, onConfirm, onCancel }: ConfirmDialogProps) {
  const viol = getViolationLabel(log.violationType);
  const defaultReason = violationCount > 1
    ? `${violationCount} violations detected by AI proctoring (latest: ${viol.label})`
    : `${viol.label} violation detected by AI proctoring`;
  const [reason, setReason] = useState(defaultReason);

  return createPortal(
    <div className="fixed inset-0 z-170 flex items-center justify-center p-4">
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
          <p><span className="text-white-soft font-medium">Violations:</span> {violationCount} (latest: {viol.icon} {viol.label})</p>
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

// ─── Participation Card ────────────────────────────────────────────────────────

interface ParticipationCardProps {
  group: ParticipationGroup;
  participation: ApiExamParticipation | null | undefined;
  examName: string | null;
  isDisqualified: boolean;
  reviewedLogIds: Set<string>;
  onClick: () => void;
}

function ParticipationCard({ group, participation, examName, isDisqualified, reviewedLogIds, onClick }: ParticipationCardProps) {
  const studentName = participation?.student?.fullName ?? participation?.student?.email ?? null;
  const severeCount = group.logs.filter((l) => l.severity === 'Severe').length;
  const warningCount = group.logs.filter((l) => l.severity === 'Warning').length;
  const reviewedCount = group.logs.filter((l) => l.reviewedBy != null || reviewedLogIds.has(l.id)).length;
  const allReviewed = reviewedCount === group.logs.length;
  const latest = group.logs[0];

  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-navy-card border border-border rounded-2xl p-4 hover:border-blue/40 hover:bg-white/2 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-blue/20 border border-blue/30 flex items-center justify-center shrink-0">
            <FiUser size={14} className="text-blue-bright" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white-soft truncate">
              {studentName ?? (participation === undefined ? 'Loading…' : `Student …${group.participationId.slice(-6)}`)}
            </p>
            {examName && <p className="text-[11px] text-blue-bright truncate mt-0.5">📝 {examName}</p>}
          </div>
        </div>
        {isDisqualified && (
          <span className="shrink-0 text-[9px] font-bold text-red bg-red/10 border border-red/30 px-2 py-0.5 rounded-full">
            Disqualified
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {severeCount > 0 && (
          <span className="text-[10px] font-bold text-red bg-red/10 border border-red/30 px-2 py-0.5 rounded-full">
            {severeCount} Severe
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full">
            {warningCount} Warning
          </span>
        )}
        {allReviewed && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-green bg-green/10 border border-green/30 px-2 py-0.5 rounded-full">
            <FiCheckCircle size={10} /> Reviewed
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted pt-3 border-t border-border/50">
        <span>{group.logs.length} violation{group.logs.length !== 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1"><FiClock size={11} /> {fmtTime(latest.recordedAt ?? latest.createdAt)}</span>
      </div>
    </button>
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

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ApiViolationLog | null>(null);
  const [confirmLog, setConfirmLog] = useState<{ log: ApiViolationLog; violationCount: number } | null>(null);

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

  // 1 bài thi (participation) = 1 nhóm, gom tất cả vi phạm của cùng 1 lượt thi lại với nhau
  const groups: ParticipationGroup[] = useMemo(() => {
    const map = new Map<string, ApiViolationLog[]>();
    filtered.forEach((l) => {
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
  }, [filtered]);

  const selectedGroup = groups.find((g) => g.participationId === selectedGroupId) ?? null;

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
    const group = groups.find((g) => g.participationId === log.participationId);
    setSelectedLog(null);
    setConfirmLog({ log, violationCount: group?.logs.length ?? 1 });
  }, [groups]);

  const handleDisqualifyGroup = useCallback((group: ParticipationGroup) => {
    setConfirmLog({ log: group.logs[0], violationCount: group.logs.length });
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

      {/* Content — 1 card = 1 exam attempt (participation), click để xem chi tiết */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-navy-card border border-border rounded-2xl h-32 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-red/30 rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-red text-sm mb-3">{error}</p>
          <button onClick={reload} className="text-xs text-blue-bright underline cursor-pointer">Retry</button>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-muted text-sm">No violations found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group) => {
              const p = participationCache[group.participationId];
              const examSlot = p?.examSlotId ? examSlotCache[p.examSlotId] : null;
              const isDisqualified = disqualifiedIds.has(group.participationId) || p?.status === 'Disqualified';
              return (
                <ParticipationCard
                  key={group.participationId}
                  group={group}
                  participation={p}
                  examName={examSlot?.examName ?? null}
                  isDisqualified={isDisqualified}
                  reviewedLogIds={reviewedLogIds}
                  onClick={() => setSelectedGroupId(group.participationId)}
                />
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

      {/* Participation Detail Modal */}
      {selectedGroup && (
        <ParticipationDetailModal
          group={selectedGroup}
          participation={participationCache[selectedGroup.participationId]}
          examName={(() => {
            const p = participationCache[selectedGroup.participationId];
            return p?.examSlotId ? (examSlotCache[p.examSlotId]?.examName ?? null) : null;
          })()}
          reviewedLogIds={reviewedLogIds}
          onClose={() => setSelectedGroupId(null)}
          onViewLog={(log) => void handleOpenEvidence(log)}
          onDisqualify={() => handleDisqualifyGroup(selectedGroup)}
          disqualifying={disqualifyingId === selectedGroup.participationId}
          alreadyDisqualified={
            disqualifiedIds.has(selectedGroup.participationId) ||
            participationCache[selectedGroup.participationId]?.status === 'Disqualified'
          }
        />
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
          violationCount={confirmLog.violationCount}
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
