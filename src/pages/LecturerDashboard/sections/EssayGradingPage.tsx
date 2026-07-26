import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiClock, FiEdit3, FiX } from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  fetchExamQuestions,
  fetchStudentExamRecords,
  gradeStudentExamRecord,
} from '../../../services/schoolAdminApi';
import { parseExamRecord, type ParsedExamRecord } from '../../../utils/examRecord';
import type { ApiExamQuestion, ApiStudentExamRecord } from '../../../types/api';

// Chấm điểm ở trang này gọi PUT /api/student-exam-records/{id}/manual-grade — BE tự validate
// (chỉ câu Essay/needsManualMarking, không vượt max points) và tự tính lại finalScore/status.

// ─── Grade modal ────────────────────────────────────────────────────────────

function GradeModal({
  record, parsed, questionsById, onClose, onSaved,
}: {
  record: ApiStudentExamRecord;
  parsed: ParsedExamRecord;
  questionsById: Map<string, ApiExamQuestion>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const essayAnswers = parsed.answers.filter((a) => a.needsManualMarking);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(essayAnswers.map((a) => [a.questionId, a.awardedPoints])),
  );
  const [saving, setSaving] = useState(false);

  const setScore = (questionId: string, maxPoints: number, val: string) => {
    const n = Math.max(0, Math.min(maxPoints, Number(val) || 0));
    setScores((prev) => ({ ...prev, [questionId]: n }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gradeStudentExamRecord(record.id, {
        grades: essayAnswers.map((a) => ({
          questionId: a.questionId,
          awardedPoints: scores[a.questionId] ?? a.awardedPoints,
        })),
      });
      toast.success('Saved', 'Grades submitted.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-card border border-border rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-navy-card">
          <div>
            <h2 className="font-syne font-bold text-white-soft text-lg">{record.studentName ?? 'Student'}</h2>
            <p className="text-xs text-muted mt-0.5">Grade essay answers — the rest are auto-graded.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors bg-transparent shrink-0">
            <FiX />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {parsed.answers.map((a, idx) => {
            const q = questionsById.get(a.questionId);
            return (
              <div key={a.questionId} className="bg-navy border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm text-white-soft font-medium leading-relaxed">
                    <span className="text-muted font-mono text-xs mr-1.5">Q{idx + 1}</span>
                    {q?.questionContent ?? '(question text unavailable)'}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold text-blue-bright bg-blue-bright/10 border border-blue-bright/25 px-2 py-0.5 rounded-full">
                      {a.questionType}
                    </span>
                    <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full">
                      {a.maxPoints} pt{a.maxPoints !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {a.needsManualMarking ? (
                  <>
                    <div className="bg-navy-card border border-border/60 rounded-lg p-3 text-sm text-white-soft/90 whitespace-pre-wrap leading-relaxed mb-3">
                      {a.answerText?.trim() || <em className="text-muted">No answer submitted.</em>}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Award points</label>
                      <input
                        type="number"
                        min={0}
                        max={a.maxPoints}
                        step="0.5"
                        value={scores[a.questionId] ?? 0}
                        onChange={(e) => setScore(a.questionId, a.maxPoints, e.target.value)}
                        className="w-24 bg-navy-card border border-border rounded-lg px-3 py-1.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-muted">/ {a.maxPoints}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted">
                    Auto-graded — selected <strong className="text-white-soft/80">{a.selectedOption ?? '—'}</strong>,
                    {' '}awarded <strong className="text-white-soft/80">{a.awardedPoints}</strong> / {a.maxPoints} pts.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => void handleSave()} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
            {saving ? 'Saving…' : 'Save Grades'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EssayGradingPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [grading, setGrading] = useState<{ record: ApiStudentExamRecord; parsed: ParsedExamRecord } | null>(null);

  const { data: questionsData } = useAsyncData(
    () => (examId ? fetchExamQuestions(examId, { pageSize: 200 }) : Promise.resolve({ items: [] as ApiExamQuestion[], pagination: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 } })),
    [examId],
  );
  const questionsById = new Map((questionsData?.items ?? []).map((q) => [q.id, q]));
  const examName = questionsData?.items[0]?.examName ?? localStorage.getItem(`examName_${examId}`) ?? 'Exam';

  const { data, loading, error, reload } = useAsyncData(
    () => (examId ? fetchStudentExamRecords({ examSlotId: examId, pageSize: 200 }) : Promise.resolve({ items: [] as ApiStudentExamRecord[], pagination: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 } })),
    [examId],
  );

  const rows = (data?.items ?? []).map((record) => ({ record, parsed: parseExamRecord(record.examRecord) }));
  const pendingCount = rows.filter((r) => r.parsed?.requiresManualMarking).length;

  return (
    <div className="space-y-6">
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center gap-4 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent shrink-0"
        >
          <FiArrowLeft />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-0.5">Essay Grading</p>
          <h1 className="font-syne text-xl font-extrabold text-white-soft truncate">{examName}</h1>
        </div>
        {pendingCount > 0 && (
          <span className="text-xs font-bold text-gold bg-gold/10 border border-gold/25 px-3 py-1.5 rounded-xl shrink-0">
            {pendingCount} need{pendingCount === 1 ? 's' : ''} grading
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-navy-card border border-border rounded-[20px] h-20 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-red/30 rounded-[20px] py-16 text-center">
          <p className="text-red text-sm mb-3">{error}</p>
          <button onClick={reload} className="text-xs text-blue-bright underline cursor-pointer bg-transparent border-none">Retry</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-muted text-sm">No submissions yet for this exam.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ record, parsed }) => {
            const needsGrading = !!parsed?.requiresManualMarking;
            return (
              <div key={record.id} className="bg-navy-card border border-border rounded-[20px] p-5 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white-soft truncate">{record.studentName ?? 'Student'}</p>
                  <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                    <FiClock size={11} /> {record.submittedAt ? new Date(record.submittedAt).toLocaleString('en-GB') : '—'}
                  </p>
                </div>

                <span className="text-sm font-bold text-white-soft bg-navy border border-border px-3 py-1.5 rounded-xl shrink-0">
                  {record.finalScore ?? 0}{parsed ? ` / ${parsed.maxScore}` : ''} pts
                </span>

                {!parsed ? (
                  <span className="text-[10px] font-bold text-muted bg-white/5 border border-border px-2.5 py-1 rounded-full shrink-0">
                    No breakdown available
                  </span>
                ) : needsGrading ? (
                  <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2.5 py-1 rounded-full shrink-0">
                    Needs Grading
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-green bg-green/10 border border-green/25 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
                    <FiCheckCircle size={11} /> Graded
                  </span>
                )}

                <button
                  onClick={() => parsed && setGrading({ record, parsed })}
                  disabled={!parsed}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-bright/30 text-blue-bright text-xs font-semibold cursor-pointer hover:bg-blue-bright/10 transition-colors bg-transparent disabled:opacity-40 shrink-0"
                >
                  <FiEdit3 size={13} /> {needsGrading ? 'Grade' : 'View'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {grading && (
        <GradeModal
          record={grading.record}
          parsed={grading.parsed}
          questionsById={questionsById}
          onClose={() => setGrading(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
