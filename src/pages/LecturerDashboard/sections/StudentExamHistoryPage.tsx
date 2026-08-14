import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiChevronDown, FiChevronUp, FiClock, FiEdit2, FiFileText, FiPlus, FiTrash2 } from 'react-icons/fi';
import { EmptyState, PageHeader, PageShell, PrimaryButton } from '../../../components/lecturer/LecturerUI';
import CustomSelect from '../../../components/ui/CustomSelect';
import Pagination from '../../../components/ui/Pagination';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  createStudentExamRecord,
  deleteStudentExamRecord,
  fetchExamQuestions,
  fetchExamSlots,
  fetchStudentExamRecords,
  updateStudentExamRecord,
} from '../../../services/schoolAdminApi';
import { parseExamRecord } from '../../../utils/examRecord';
import type { ApiExamQuestion, ApiStudentExamRecord } from '../../../types/api';

type RecordStatus = 'Marked' | 'Completed';

interface RecordFormData {
  examSlotId: string;
  finalScore: string;
  status: RecordStatus;
}

/** Modal tạo/sửa 1 student exam record thủ công — dùng cho case thi bù/thi giấy không qua flow
 *  submit bình thường, hoặc chỉnh sửa hành chính (sửa điểm nhập nhầm...). Không sửa được examSlot
 *  sau khi tạo (khớp UpdateStudentExamRecordDto của BE không có field này). */
function RecordFormModal({
  editTarget,
  studentId,
  availableSlots,
  onClose,
  onSaved,
}: {
  editTarget: ApiStudentExamRecord | null;
  studentId: string;
  availableSlots: { id: string; examName: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!editTarget;
  const [form, setForm] = useState<RecordFormData>({
    examSlotId: editTarget?.examSlotId ?? '',
    finalScore: editTarget?.finalScore != null ? String(editTarget.finalScore) : '',
    status: (editTarget?.status as RecordStatus) ?? 'Marked',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isEdit && !form.examSlotId) {
      toast.error('Error', 'Please select an exam.');
      return;
    }
    setSaving(true);
    try {
      const finalScore = form.finalScore.trim() === '' ? undefined : Number(form.finalScore);
      if (isEdit) {
        await updateStudentExamRecord(editTarget.id, { finalScore, status: form.status });
        toast.success('Updated', 'Exam record updated.');
      } else {
        await createStudentExamRecord({
          examSlotId: form.examSlotId,
          studentId,
          finalScore,
          status: form.status,
        });
        toast.success('Created', 'Exam record added.');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save exam record.';
      toast.error('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-syne font-bold text-white-soft text-base">
            {isEdit ? 'Edit Exam Record' : 'Add Manual Exam Record'}
          </h3>
        </div>

        {!isEdit && (
          <div>
            <label className="text-xs text-muted font-semibold uppercase tracking-wider mb-1.5 block">Exam</label>
            <CustomSelect
              value={form.examSlotId}
              onChange={(v) => setForm((f) => ({ ...f, examSlotId: v }))}
              options={availableSlots.map((s) => ({ value: s.id, label: s.examName }))}
              placeholder="Select exam…"
            />
            {availableSlots.length === 0 && (
              <p className="text-xs text-muted mt-1.5">No exams available to add — this student already has records for every exam in this class.</p>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-muted font-semibold uppercase tracking-wider mb-1.5 block">Final Score</label>
          <input
            type="number"
            value={form.finalScore}
            onChange={(e) => setForm((f) => ({ ...f, finalScore: e.target.value }))}
            placeholder="e.g. 85"
            className="w-full bg-navy border border-border rounded-xl px-4 py-2 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        <div>
          <label className="text-xs text-muted font-semibold uppercase tracking-wider mb-1.5 block">Status</label>
          <CustomSelect
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as RecordStatus }))}
            options={[
              { value: 'Marked', label: 'Graded' },
              { value: 'Completed', label: 'Pending Grading' },
            ]}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!isEdit && !form.examSlotId)}
            className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-40 transition-colors border-none"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Record'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

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
  const toast = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiStudentExamRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiStudentExamRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stateName = (location.state as { studentName?: string } | null)?.studentName ?? null;

  const { data, loading, error, reload } = useAsyncData(
    () => (studentId ? fetchStudentExamRecords({ studentId, pageSize: 100 }) : Promise.resolve(null)),
    [studentId],
  );
  const records = (data?.items ?? [])
    .filter((r) => r.status.toLowerCase() !== 'deleted')
    .sort((a, b) => new Date(b.submittedAt ?? b.createdAt).getTime() - new Date(a.submittedAt ?? a.createdAt).getTime());

  // Danh sách exam của lớp này, dùng để chọn khi tạo record thủ công — loại bỏ những exam student
  // đã có record rồi (tránh tạo trùng, dù BE không chặn cứng việc này).
  const { data: classSlots } = useAsyncData(
    () => (classId ? fetchExamSlots({ page: 1, pageSize: 200 }) : Promise.resolve(null)),
    [classId],
  );
  const recordedSlotIds = new Set(records.map((r) => r.examSlotId));
  const availableSlots = (classSlots?.items ?? [])
    .filter((s) => s.classId === classId && !recordedSlotIds.has(s.id))
    .map((s) => ({ id: s.id, examName: s.examName }));

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStudentExamRecord(deleteTarget.id);
      toast.success('Deleted', 'Exam record deleted.');
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error('Error', 'Failed to delete exam record.');
    } finally {
      setDeleting(false);
    }
  };

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
          <div className="flex items-center gap-2">
            <PrimaryButton variant="ghost" onClick={() => setShowAddModal(true)}>
              <FiPlus /> Add Record
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => navigate(`/lecture/classes/${classId}`)}>
              <FiArrowLeft /> Back to Roster
            </PrimaryButton>
          </div>
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
                    <div className="flex items-stretch">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className="flex-1 min-w-0 text-left p-3.5 cursor-pointer bg-transparent border-none hover:bg-white/2 transition-colors"
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
                      <div className="flex items-center gap-1 pr-3 shrink-0">
                        <button
                          onClick={() => setEditTarget(r)}
                          className="w-7 h-7 rounded-lg bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-blue-bright hover:border-blue/40 transition-all"
                          title="Edit record"
                        >
                          <FiEdit2 className="text-xs" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="w-7 h-7 rounded-lg bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-all"
                          title="Delete record"
                        >
                          <FiTrash2 className="text-xs" />
                        </button>
                      </div>
                    </div>
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

      {showAddModal && studentId && (
        <RecordFormModal
          editTarget={null}
          studentId={studentId}
          availableSlots={availableSlots}
          onClose={() => setShowAddModal(false)}
          onSaved={reload}
        />
      )}
      {editTarget && studentId && (
        <RecordFormModal
          editTarget={editTarget}
          studentId={studentId}
          availableSlots={availableSlots}
          onClose={() => setEditTarget(null)}
          onSaved={reload}
        />
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-syne font-bold text-white-soft text-base">Delete Exam Record</h3>
                <p className="text-muted text-sm mt-1">
                  Delete the record for{' '}
                  <span className="text-white-soft font-semibold break-all">{deleteTarget.examName ?? 'this exam'}</span>?
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-semibold cursor-pointer hover:bg-red/80 transition-colors border-none disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </PageShell>
  );
}
