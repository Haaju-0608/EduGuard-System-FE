import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiImage, FiMusic, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  createExamQuestion,
  createQuestionOption,
  deleteExamQuestion,
  deleteQuestionOption,
  fetchExamQuestions,
  fetchExamSlots,
  updateExamQuestion,
  updateQuestionOption,
} from '../../../services/schoolAdminApi';
import type { ApiExamQuestion, ApiQuestionOption } from '../../../types/api';

// ─── Types ────────────────────────────────────────────────────────────────

/** BE chỉ validate MaxLength(30), không có enum cố định — nhưng chấm điểm tự động chỉ
 *  phân biệt đúng 2 nhánh: có options + type !== "Essay" (auto-grade) vs còn lại (manual).
 *  MCQ/Listening/Reading đều auto-grade bằng options; chỉ Essay là chấm tay. */
type QuestionType = 'MCQ' | 'Listening' | 'Reading' | 'Essay';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'Listening', label: 'Listening' },
  { value: 'Reading', label: 'Reading' },
  { value: 'Essay', label: 'Essay (manual grading)' },
];

interface EditableOption {
  /** id thật từ BE nếu đã tồn tại, id tạm (client-side) nếu mới thêm chưa lưu */
  id: string;
  optionLabel: string;
  optionContent: string;
  isCorrect: boolean;
  isNew: boolean;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

function letter(i: number) { return String.fromCharCode(65 + i); }
function tempId() { return `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

function emptyOptions(): EditableOption[] {
  return Array.from({ length: 4 }, (_, i) => ({
    id: tempId(),
    optionLabel: letter(i),
    optionContent: '',
    isCorrect: i === 0,
    isNew: true,
  }));
}

// ─── Modal ────────────────────────────────────────────────────────────────

interface ModalProps {
  examId: string;
  displayOrder: number;
  initial?: ApiExamQuestion;
  onClose: () => void;
  onSaved: () => void;
}

function QuestionModal({ examId, displayOrder, initial, onClose, onSaved }: ModalProps) {
  const toast = useToast();
  const [questionType, setQuestionType] = useState<QuestionType>(() => {
    const match = QUESTION_TYPES.find((t) => t.value.toLowerCase() === initial?.questionType.toLowerCase());
    return match?.value ?? 'MCQ';
  });
  const [text, setText] = useState(initial?.questionContent ?? '');
  const [points, setPoints] = useState(initial?.points ?? 1);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [imageError, setImageError] = useState(false);
  const [audioUrl, setAudioUrl] = useState(initial?.audioUrl ?? '');
  const [options, setOptions] = useState<EditableOption[]>(() =>
    initial
      ? initial.options.map((o) => ({
          id: o.id, optionLabel: o.optionLabel, optionContent: o.optionContent,
          isCorrect: !!o.isCorrect, isNew: false,
        }))
      : emptyOptions(),
  );
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial;

  const updateOptionText = (id: string, val: string) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, optionContent: val } : o)));

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, { id: tempId(), optionLabel: letter(prev.length), optionContent: '', isCorrect: false, isNew: true }]);
  };

  const removeOption = (id: string) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => {
      const next = prev.filter((o) => o.id !== id);
      if (!next.some((o) => o.isCorrect) && next.length > 0) next[0].isCorrect = true;
      return next.map((o, i) => ({ ...o, optionLabel: letter(i) }));
    });
  };

  const isEssay = questionType === 'Essay';

  const handleSave = async () => {
    if (!text.trim()) { toast.warning('Required', 'Enter question text.'); return; }
    if (!isEssay) {
      if (options.some((o) => !o.optionContent.trim())) { toast.warning('Required', 'All options must be filled in.'); return; }
      if (!options.some((o) => o.isCorrect)) { toast.warning('Required', 'Mark one option as correct.'); return; }
    }
    if (points < 0) { toast.warning('Invalid', 'Points must be 0 or more.'); return; }

    setSaving(true);
    try {
      if (isEdit && initial) {
        await updateExamQuestion(initial.id, {
          questionType,
          questionContent: text.trim(),
          imageUrl: imageUrl.trim() || null,
          audioUrl: audioUrl.trim() || null,
          points,
          displayOrder: initial.displayOrder,
        });

        // Diff options: xoá option cũ bị bỏ, tạo option mới, cập nhật option còn lại.
        // Essay không có options → xoá hết options cũ (nếu question trước đó là MCQ).
        const originalIds = new Set(initial.options.map((o) => o.id));
        const currentExistingIds = isEssay ? new Set<string>() : new Set(options.filter((o) => !o.isNew).map((o) => o.id));
        const removedIds = [...originalIds].filter((id) => !currentExistingIds.has(id));

        await Promise.all([
          ...removedIds.map((id) => deleteQuestionOption(id)),
          ...(isEssay ? [] : options.map((o) => {
            const payload = { optionLabel: o.optionLabel, optionContent: o.optionContent.trim(), isCorrect: o.isCorrect };
            return o.isNew
              ? createQuestionOption(initial.id, payload)
              : updateQuestionOption(o.id, payload);
          })),
        ]);

        toast.success('Updated', 'Question updated.');
      } else {
        await createExamQuestion({
          examSlotId: examId,
          questionType,
          questionContent: text.trim(),
          imageUrl: imageUrl.trim() || null,
          audioUrl: audioUrl.trim() || null,
          points,
          displayOrder,
          options: isEssay ? [] : options.map((o) => ({
            optionLabel: o.optionLabel,
            optionContent: o.optionContent.trim(),
            isCorrect: o.isCorrect,
          })),
        });
        toast.success('Added', 'Question added.');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error.';
      toast.error('Failed to save', msg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-navy-card border border-border rounded-[20px] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-syne font-bold text-white-soft text-lg">
            {isEdit ? 'Edit Question' : 'Add Question'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors bg-transparent">
            <FiX />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Question type */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Question Type</label>
            <div className="grid grid-cols-2 gap-2">
              {QUESTION_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQuestionType(value)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                    questionType === value
                      ? 'border-blue-bright/50 bg-blue-bright/10 text-blue-bright'
                      : 'border-border text-muted hover:border-blue-bright/30'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isEssay && (
              <p className="mt-1.5 text-[11px] text-muted">
                Student answers will be graded manually — no answer options needed here.
              </p>
            )}
          </div>

          {/* Question text */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Question *</label>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter question text..."
              className="w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/50 transition-colors resize-none"
            />
          </div>

          {/* Points */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Max Points <span className="normal-case font-normal">{isEssay ? '(the ceiling a lecturer can award when grading this answer manually)' : "(awarded automatically when the student's answer is correct)"}</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="w-32 bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Image URL <span className="normal-case font-normal">(optional — paste a link to an existing image; direct file upload isn't supported yet)</span>
            </label>
            <div className="flex items-center gap-2 bg-navy border border-border rounded-xl px-3 py-2.5 focus-within:border-blue-bright/50 transition-colors">
              <FiImage className="text-muted shrink-0" />
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImageError(false); }}
                placeholder="https://..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
              />
            </div>
            {imageUrl.trim() && !imageError && (
              <img
                src={imageUrl.trim()}
                alt="Question preview"
                onError={() => setImageError(true)}
                className="mt-2 w-full max-h-40 object-contain rounded-xl border border-border bg-navy"
              />
            )}
            {imageUrl.trim() && imageError && (
              <p className="mt-2 text-xs text-red">Could not load image from this URL.</p>
            )}
          </div>

          {/* Audio URL */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Audio URL <span className="normal-case font-normal">(optional — for Listening questions; paste a link to an audio file)</span>
            </label>
            <div className="flex items-center gap-2 bg-navy border border-border rounded-xl px-3 py-2.5 focus-within:border-blue-bright/50 transition-colors">
              <FiMusic className="text-muted shrink-0" />
              <input
                type="text"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
              />
            </div>
            {audioUrl.trim() && (
              <audio controls src={audioUrl.trim()} className="mt-2 w-full h-10" />
            )}
          </div>

          {/* Options */}
          {!isEssay && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Options * <span className="normal-case font-normal">— click a letter to mark correct</span>
              </label>
              <span className="text-[10px] text-muted">{options.length}/{MAX_OPTIONS}</span>
            </div>

            <div className="space-y-2.5">
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => prev.map((o) => ({ ...o, isCorrect: o.id === opt.id })))}
                    className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                      opt.isCorrect ? 'border-green bg-green/20 text-green' : 'border-border text-muted hover:border-blue-bright/40'
                    }`}
                  >
                    {opt.optionLabel}
                  </button>
                  <input
                    type="text"
                    value={opt.optionContent}
                    onChange={(e) => updateOptionText(opt.id, e.target.value)}
                    placeholder={`Option ${opt.optionLabel}`}
                    className="flex-1 bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/50 transition-colors"
                  />
                  {opt.isCorrect && (
                    <span className="text-[10px] font-bold text-green shrink-0 w-14">✓ Correct</span>
                  )}
                  {options.length > MIN_OPTIONS ? (
                    <button type="button" onClick={() => removeOption(opt.id)}
                      className="shrink-0 w-6 h-6 rounded-full text-muted hover:text-red hover:bg-red/10 flex items-center justify-center transition-colors cursor-pointer">
                      <FiX size={12} />
                    </button>
                  ) : (
                    <span className="w-6 shrink-0" />
                  )}
                </div>
              ))}
            </div>
            {options.length < MAX_OPTIONS && (
              <button type="button" onClick={addOption}
                className="mt-3 flex items-center gap-2 text-xs text-blue-bright hover:text-blue-bright/80 transition-colors cursor-pointer bg-transparent border-none">
                <FiPlus size={13} /> Add option
              </button>
            )}
          </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent disabled:opacity-50">
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Question'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ExamQuestionsPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<ApiExamQuestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiExamQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: slotsData } = useAsyncData(async () => {
    const result = await fetchExamSlots({ page: 1, pageSize: 200 });
    return result.items;
  }, []);
  const slot = slotsData?.find((s) => s.id === examId);

  const { data, loading, error, reload } = useAsyncData(
    () => (examId ? fetchExamQuestions(examId, { pageSize: 200 }) : Promise.resolve({ items: [] as ApiExamQuestion[], pagination: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 } })),
    [examId],
  );
  const questions = [...(data?.items ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExamQuestion(deleteTarget.id);
      toast.success('Deleted', 'Question removed.');
      setDeleteTarget(null);
      reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error.';
      toast.error('Failed to delete', msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center gap-4 flex-wrap">
        <button
          onClick={() => navigate('/school/exams')}
          className="flex items-center gap-2 text-xs text-muted hover:text-blue-bright transition-colors cursor-pointer mb-4 bg-transparent border-none"
        >
          <FiArrowLeft /> Back to Exams
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap w-full">
          <div>
            <h1 className="font-syne text-2xl font-extrabold text-white-soft">
              {slot ? slot.examName : 'Exam Questions'}
            </h1>
            {slot && (
              <p className="text-muted text-sm mt-1">
                <span className="font-mono text-[11px] bg-navy border border-border px-2 py-0.5 rounded-full mr-2">{slot.classCode}</span>
                {slot.className}
              </p>
            )}
          </div>
          <button
            onClick={() => { setEditing(null); setModal('create'); }}
            disabled={!examId}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue text-white rounded-xl text-sm font-semibold hover:bg-blue/80 transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            <FiPlus /> Add Question
          </button>
        </div>
      </div>

      {/* Count */}
      <div className="flex justify-end">
        <div className="bg-navy-card border border-border rounded-xl px-4 py-2.5 text-sm text-muted">
          <span className="font-bold text-white-soft">{questions.length}</span> question{questions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Question list */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-navy-card border border-border rounded-[20px] h-32 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-red/30 rounded-[20px] py-16 text-center">
          <p className="text-red text-sm mb-3">{error}</p>
          <button onClick={reload} className="text-xs text-blue-bright underline cursor-pointer bg-transparent border-none">Retry</button>
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-muted text-sm">No questions yet. Click "Add Question" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q: ApiExamQuestion, i: number) => (
            <div key={q.id} className="bg-navy-card border border-border rounded-[20px] p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted bg-navy border border-border px-2 py-0.5 rounded-full font-mono">
                    Q{i + 1}
                  </span>
                  <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full">
                    {q.points} pt{q.points !== 1 ? 's' : ''}
                  </span>
                  {(() => {
                    const type = q.questionType.toLowerCase();
                    if (type === 'essay') {
                      return (
                        <span className="text-[10px] font-bold text-cyan bg-cyan/10 border border-cyan/25 px-2 py-0.5 rounded-full">
                          Essay · manual grading
                        </span>
                      );
                    }
                    const label = QUESTION_TYPES.find((t) => t.value.toLowerCase() === type)?.label ?? q.questionType;
                    return (
                      <span className="text-[10px] font-bold text-blue-bright bg-blue-bright/10 border border-blue-bright/25 px-2 py-0.5 rounded-full">
                        {label}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => { setEditing(q); setModal('edit'); }} className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-blue-bright transition-colors cursor-pointer">
                    <FiEdit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(q)} className="p-1.5 rounded-lg hover:bg-red/10 text-muted hover:text-red transition-colors cursor-pointer">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-white-soft font-medium leading-relaxed mb-4">{q.questionContent}</p>

              {q.imageUrl && (
                <img
                  src={q.imageUrl}
                  alt={`Question ${i + 1}`}
                  className="w-full max-h-60 object-contain rounded-xl border border-border bg-navy mb-4"
                />
              )}

              {q.audioUrl && (
                <audio controls src={q.audioUrl} className="w-full h-10 mb-4" />
              )}

              {q.questionType.toLowerCase() === 'essay' ? (
                <p className="text-xs text-muted italic">Free-text answer — graded manually after submission.</p>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt: ApiQuestionOption) => (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs border ${
                      opt.isCorrect
                        ? 'border-green/40 bg-green/10 text-green font-semibold'
                        : 'border-border/50 bg-navy/40 text-muted'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      opt.isCorrect ? 'border-green text-green' : 'border-border text-muted'
                    }`}>
                      {opt.optionLabel}
                    </span>
                    <span className="flex-1">{opt.optionContent}</span>
                    {opt.isCorrect && <span className="shrink-0">✓</span>}
                  </div>
                ))}
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && examId && (
        <QuestionModal
          examId={examId}
          displayOrder={questions.length}
          initial={modal === 'edit' && editing ? editing : undefined}
          onClose={() => { setModal(null); setEditing(null); }}
          onSaved={reload}
        />
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-card border border-border rounded-[20px] shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-syne font-bold text-white-soft">Delete Question?</h3>
            <p className="text-sm text-muted leading-relaxed">
              "{deleteTarget.questionContent.slice(0, 80)}{deleteTarget.questionContent.length > 80 ? '…' : ''}"
            </p>
            <p className="text-xs text-red">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white-soft transition-all cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => void confirmDelete()} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red/90 text-white text-sm font-semibold hover:bg-red transition-all cursor-pointer disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
