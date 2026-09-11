import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiAward, FiBookOpen, FiCalendar, FiCheckCircle, FiClock, FiMail, FiPhone, FiShield, FiTrash2, FiX, FiXCircle,
} from 'react-icons/fi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../contexts/ToastContext';
import { fetchStudentDetail, revokeStudentBiometricData } from '../../services/schoolAdminApi';

// GET /api/users/{id}/detail — hồ sơ tổng hợp 1 sinh viên (SuperAdmin/SchoolAdmin cùng trường).
// Dùng chung cho cả UserManagementPage.tsx (SuperAdmin) và SchoolStudentManagementPage.tsx
// (SchoolAdmin) — chỉ cần truyền đúng studentId, tự fetch, không cần truyền sẵn data.

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }) {
  const cls =
    tone === 'ok' ? 'text-green bg-green/10 border-green/25' :
    tone === 'warn' ? 'text-gold bg-gold/10 border-gold/25' :
    tone === 'danger' ? 'text-red bg-red/10 border-red/25' :
    'text-muted bg-white/5 border-border';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function participationTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'submitted') return 'ok';
  if (s === 'disqualified') return 'danger';
  if (s === 'joined') return 'warn';
  return 'neutral';
}

function attendanceTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'present' || s === 'late') return 'ok';
  if (s === 'absent') return 'danger';
  return 'neutral';
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-navy border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-wider mb-3">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="text-xs text-muted text-center py-4">{label}</p>;
}

export default function StudentDetailModal({
  studentId, onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(() => fetchStudentDetail(studentId), [studentId]);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await revokeStudentBiometricData(studentId);
      toast.success('Revoked', 'All face data for this student has been revoked. They must register again.');
      setConfirmRevoke(false);
      reload();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to revoke biometric data.');
    } finally {
      setRevoking(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-navy-card border border-border rounded-[20px] w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-syne font-bold text-white-soft text-lg">Student Detail</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors shrink-0">
            <FiX />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error || !data ? (
            <p className="text-sm text-red text-center py-8">Failed to load student detail.</p>
          ) : (
            <>
              {/* Header info */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-blue-bright font-bold text-sm shrink-0">
                  {data.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-white-soft">{data.fullName}</p>
                    <StatusPill label={data.status} tone={data.status.toLowerCase() === 'active' ? 'ok' : 'neutral'} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted flex-wrap">
                    <span className="flex items-center gap-1"><FiMail size={10} />{data.email}</span>
                    {data.phone && <span className="flex items-center gap-1"><FiPhone size={10} />{data.phone}</span>}
                    {data.studentCode && <span className="font-mono">{data.studentCode}</span>}
                    <span className="flex items-center gap-1"><FiCalendar size={10} />Joined {fmtDate(data.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Biometric */}
              <SectionCard icon={<FiShield />} title="Biometric Status">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {data.biometric.hasActiveBiometric ? (
                      <><FiCheckCircle className="text-green" /><span className="text-sm text-white-soft">Registered ({data.biometric.activeVectorCount}/3 vectors active)</span></>
                    ) : (
                      <><FiXCircle className="text-muted" /><span className="text-sm text-muted">Not registered</span></>
                    )}
                  </div>
                  {data.biometric.latestRequestStatus && (
                    <StatusPill
                      label={data.biometric.latestRequestStatus}
                      tone={
                        data.biometric.latestRequestStatus.toLowerCase() === 'approved' ? 'ok' :
                        data.biometric.latestRequestStatus.toLowerCase() === 'rejected' ? 'danger' : 'warn'
                      }
                    />
                  )}
                </div>
                {data.biometric.latestRequestReviewedAt && (
                  <p className="text-[11px] text-muted mt-2">Last reviewed {fmtDateTime(data.biometric.latestRequestReviewedAt)}</p>
                )}
                {data.biometric.latestRequestReason && (
                  <p className="text-[11px] text-muted mt-1 italic">"{data.biometric.latestRequestReason}"</p>
                )}
                {data.biometric.hasActiveBiometric && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {!confirmRevoke ? (
                      <button
                        onClick={() => setConfirmRevoke(true)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-red bg-transparent border-none cursor-pointer hover:underline"
                      >
                        <FiTrash2 size={11} /> Revoke face data
                      </button>
                    ) : (
                      <div className="bg-red/5 border border-red/20 rounded-xl p-3 space-y-2">
                        <p className="text-[11px] text-muted">
                          This permanently deletes all registered face vectors for this student. They will need
                          to register their face again before attending or taking exams. Are you sure?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmRevoke(false)}
                            disabled={revoking}
                            className="px-3 py-1.5 rounded-lg border border-border text-muted text-[11px] cursor-pointer hover:border-muted/50 transition-colors bg-transparent disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleRevoke}
                            disabled={revoking}
                            className="px-3 py-1.5 rounded-lg bg-red text-white text-[11px] font-semibold cursor-pointer hover:bg-red/80 transition-colors border-none disabled:opacity-50"
                          >
                            {revoking ? 'Revoking…' : 'Yes, revoke it'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Exam results */}
              <SectionCard icon={<FiAward />} title={`Exam Results (${data.examResults.length})`}>
                {data.examResults.length === 0 ? <EmptyRow label="No graded exam results yet." /> : (
                  <div className="space-y-2">
                    {data.examResults.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="text-white-soft truncate">{r.examName ?? '—'}</p>
                          <p className="text-[11px] text-muted">{r.courseName ?? '—'} · {fmtDateTime(r.submittedAt)}</p>
                        </div>
                        <p className="font-syne font-bold text-cyan shrink-0">{r.finalScore ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Exam participations */}
              <SectionCard icon={<FiClock />} title={`Exam Participations (${data.examParticipations.length})`}>
                {data.examParticipations.length === 0 ? <EmptyRow label="No exam participation records." /> : (
                  <div className="space-y-2">
                    {data.examParticipations.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="text-white-soft truncate">{p.examName ?? '—'}</p>
                          <p className="text-[11px] text-muted flex items-center gap-1.5">
                            {p.courseName ?? '—'}
                            {p.identityVerified ? (
                              <span className="text-green flex items-center gap-0.5"><FiCheckCircle size={9} />ID verified</span>
                            ) : (
                              <span className="text-muted flex items-center gap-0.5"><FiXCircle size={9} />Not verified</span>
                            )}
                          </p>
                          {p.disqualifiedReason && <p className="text-[11px] text-red mt-0.5">{p.disqualifiedReason}</p>}
                        </div>
                        <StatusPill label={p.status} tone={participationTone(p.status)} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Attendance history */}
              <SectionCard icon={<FiBookOpen />} title={`Attendance History (${data.attendanceHistory.length})`}>
                {data.attendanceHistory.length === 0 ? <EmptyRow label="No attendance records." /> : (
                  <div className="space-y-2">
                    {data.attendanceHistory.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="text-white-soft truncate">{a.courseName ?? '—'}</p>
                          <p className="text-[11px] text-muted">{a.method} · {fmtDateTime(a.checkinAt)}</p>
                        </div>
                        <StatusPill label={a.status} tone={attendanceTone(a.status)} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
