import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiChevronUp, FiClock, FiFileText, FiX } from 'react-icons/fi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchExamQuestions, fetchStudentExamRecords } from '../../services/schoolAdminApi';
import { parseExamRecord } from '../../utils/examRecord';
import type { ApiExamQuestion, ApiStudentExamRecord } from '../../types/api';

/** "Marked" = đã chấm xong hết (kể cả câu Essay), "Completed" = còn câu chờ chấm tay */
function ExamRecordStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'marked') {
    return <span className="text-[10px] font-bold text-green bg-green/10 border border-green/25 px-2 py-0.5 rounded-full shrink-0">Graded</span>;
  }
  if (s === 'completed') {
    return <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full shrink-0">Pending Grading</span>;
  }
  return <span className="text-[10px] font-bold text-muted bg-white/5 border border-border px-2 py-0.5 rounded-full shrink-0">{status}</span>;
}

/** Chi tiết từng câu trả lời của 1 bài nộp — fetch câu hỏi của đúng exam đó để hiện nội dung câu hỏi
 *  + nội dung option đã chọn (ExamRecord JSON chỉ lưu questionId/optionId, không lưu text). */
function RecordAnswerBreakdown({ record }: { record: ApiStudentExamRecord }) {
  const parsed = parseExamRecord(record.examRecord);
  const { data, loading } = useAsyncData(
    () => fetchExamQuestions(record.examSlotId, { pageSize: 200 }),
    [record.examSlotId],
  );
  const questionsById = new Map((data?.items ?? []).map((q) => [q.id, q]));

  if (!parsed) {
    return <p className="text-xs text-muted px-3.5 pb-3.5">No answer breakdown available for this submission.</p>;
  }
  if (loading) {
    return (
      <div className="px-3.5 pb-3.5 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="px-3.5 pb-3.5 space-y-2">
      {parsed.answers.map((a, idx) => {
        const q: ApiExamQuestion | undefined = questionsById.get(a.questionId);
        const selectedOpt = a.optionId ? q?.options.find((o) => o.id === a.optionId) : undefined;
        const isEssay = a.questionType.toLowerCase() === 'essay';
        return (
          <div key={a.questionId} className="bg-navy-card border border-border/60 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-xs text-white-soft/90 leading-relaxed">
                <span className="text-muted font-mono mr-1.5">Q{idx + 1}</span>
                {q?.questionContent ?? '(question text unavailable)'}
              </p>
              <span className={`text-[10px] font-bold shrink-0 ${a.awardedPoints >= a.maxPoints ? 'text-green' : a.awardedPoints > 0 ? 'text-gold' : 'text-red'}`}>
                {a.awardedPoints} / {a.maxPoints} pts
              </span>
            </div>
            {isEssay ? (
              <div className="bg-navy border border-border/50 rounded-md p-2.5 text-xs text-white-soft/80 whitespace-pre-wrap leading-relaxed">
                {a.answerText?.trim() || <em className="text-muted">No answer submitted.</em>}
                {a.needsManualMarking && (
                  <p className="text-[10px] text-gold mt-1.5">Not graded yet.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Selected <strong className="text-white-soft/80">{a.selectedOption ?? '—'}</strong>
                {selectedOpt && <> — {selectedOpt.optionContent}</>}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Modal xem lịch sử bài thi của 1 sinh viên (mọi exam, mọi lớp) — dùng cho Lecturer. Bấm vào 1
 *  bài để mở rộng xem chi tiết từng câu đã làm như nào. */
export default function StudentExamHistoryModal({
  studentId, studentName, onClose,
}: { studentId: string; studentName: string; onClose: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, loading, error } = useAsyncData(
    () => fetchStudentExamRecords({ studentId, pageSize: 100 }),
    [studentId],
  );
  const records = (data?.items ?? [])
    .filter((r) => r.status.toLowerCase() !== 'deleted')
    .sort((a, b) => new Date(b.submittedAt ?? b.createdAt).getTime() - new Date(a.submittedAt ?? a.createdAt).getTime());

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-center justify-center p-4"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-navy-card border border-border rounded-[20px] w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FiFileText className="text-blue-bright" />
            <div>
              <h2 className="font-syne font-bold text-white-soft">Exam History</h2>
              <p className="text-xs text-muted mt-0.5">{studentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-white-soft hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-navy/40 border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-red text-sm text-center py-8">{error}</p>
          ) : records.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">No exam submissions yet.</p>
          ) : (
            <div className="space-y-2.5">
              {records.map((r: ApiStudentExamRecord) => {
                const parsed = parseExamRecord(r.examRecord);
                const isExpanded = expandedId === r.id;
                return (
                  <div key={r.id} className="bg-navy border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="w-full text-left p-3.5 cursor-pointer bg-transparent border-none hover:bg-white/2 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-white-soft truncate">{r.examName ?? 'Exam'}</p>
                        <ExamRecordStatusBadge status={r.status} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted flex items-center gap-1.5">
                          <FiClock size={11} />
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-GB') : '—'}
                        </p>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-white-soft">
                            {r.finalScore ?? 0}{parsed ? ` / ${parsed.maxScore}` : ''} pts
                          </span>
                          {isExpanded ? <FiChevronUp className="text-muted" size={14} /> : <FiChevronDown className="text-muted" size={14} />}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border/50 pt-2.5">
                        <RecordAnswerBreakdown record={r} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-muted text-xs font-semibold hover:border-blue/40 hover:text-white-soft transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
