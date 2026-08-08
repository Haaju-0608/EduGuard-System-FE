import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiChevronDown, FiChevronUp, FiClock, FiFileText } from 'react-icons/fi';
import { EmptyState, PageHeader, PageShell, PrimaryButton } from '../../../components/lecturer/LecturerUI';
import Pagination from '../../../components/ui/Pagination';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchExamQuestions, fetchStudentExamRecords } from '../../../services/schoolAdminApi';
import { parseExamRecord } from '../../../utils/examRecord';
import type { ApiExamQuestion, ApiStudentExamRecord } from '../../../types/api';

/** "Marked" = đã chấm xong hết, "Completed" = còn câu chờ chấm tay */
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
            <p className="text-xs text-muted">
              Selected <strong className="text-white-soft/80">{a.selectedOption ?? '—'}</strong>
              {selectedOpt && <> — {selectedOpt.optionContent}</>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Lịch sử bài thi của 1 sinh viên (mọi exam, mọi lớp — fetchStudentExamRecords không lọc theo
 *  classId, xem ghi chú ở schoolAdminApi.ts) — bấm vào 1 bài để xổ ra chi tiết từng câu multiple
 *  choice đã làm. Vào từ ClassStudentsPage (kèm state.studentName để khỏi hiện tên rỗng lúc
 *  đang tải), hoặc trực tiếp qua URL thì fallback hiện "Student" cho tới khi có record đầu tiên. */
const PAGE_SIZE = 10;

export default function StudentExamHistoryPage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const stateName = (location.state as { studentName?: string } | null)?.studentName ?? null;

  const { data, loading, error } = useAsyncData(
    () => (studentId ? fetchStudentExamRecords({ studentId, pageSize: 100 }) : Promise.resolve(null)),
    [studentId],
  );
  const records = (data?.items ?? [])
    .filter((r) => r.status.toLowerCase() !== 'deleted')
    .sort((a, b) => new Date(b.submittedAt ?? b.createdAt).getTime() - new Date(a.submittedAt ?? a.createdAt).getTime());

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = records.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const studentName = stateName ?? records[0]?.studentName ?? 'Student';
  const gradedCount = records.filter((r) => r.status.toLowerCase() === 'marked').length;
  const avgScore = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + (r.finalScore ?? 0), 0) / records.length)
    : 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Exam Class Management"
        title={studentName}
        subtitle="Full exam submission history for this student, across all classes."
        actions={
          <PrimaryButton variant="ghost" onClick={() => navigate(`/lecture/classes/${classId}`)}>
            <FiArrowLeft /> Back to Roster
          </PrimaryButton>
        }
        stats={[
          { label: 'Exams Taken', value: String(records.length), icon: '📝' },
          { label: 'Graded', value: String(gradedCount), icon: '✅' },
          { label: 'Avg. Score', value: String(avgScore), icon: '📊' },
        ]}
      />

      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <FiFileText className="text-blue-bright" />
          <p className="text-sm font-bold text-white-soft">Exam History</p>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-navy/40 border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-red text-sm text-center py-8">{error}</p>
          ) : records.length === 0 ? (
            <EmptyState icon="📝" title="No exam submissions yet" description="This student hasn't submitted any exams." />
          ) : (
            <div className="space-y-2.5">
              {pageItems.map((r: ApiStudentExamRecord) => {
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

        {!loading && !error && (
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} className="px-5 py-3.5 border-t border-border" />
        )}
      </div>
    </PageShell>
  );
}
