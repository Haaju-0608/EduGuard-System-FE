import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiBookOpen, FiEdit2, FiImage, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  createExamQuestion,
  createQuestionOption,
  createReadingPassage,
  deleteExamQuestion,
  deleteQuestionOption,
  deleteReadingPassage,
  fetchExamQuestions,
  fetchExamSlots,
  updateExamQuestion,
  updateQuestionOption,
  updateReadingPassage,
} from '../../../services/schoolAdminApi';
import { getPassageAndQuestion, groupQuestionsByPassage } from '../../../utils/readingQuestion';
import type { ApiExamQuestion, ApiQuestionOption } from '../../../types/api';

// ─── Types ────────────────────────────────────────────────────────────────

/** BE chỉ validate MaxLength(30), không có enum cố định — mọi loại câu hỏi đều auto-grade bằng
 *  options (không còn Essay/chấm tay). */
type QuestionType = 'MCQ' | 'Listening' | 'Reading';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'Listening', label: 'Listening' },
  { value: 'Reading', label: 'Reading' },
];

// Chỉ MCQ/Reading còn cho chọn khi tạo/sửa câu hỏi — Listening bị bỏ khỏi bộ chọn theo yêu cầu,
// nhưng vẫn giữ trong QUESTION_TYPES để câu hỏi cũ (nếu có) vẫn hiển thị đúng label.
const SELECTABLE_QUESTION_TYPES = QUESTION_TYPES.filter((t) => t.value === 'MCQ' || t.value === 'Reading');

interface EditableOption {
  /** id thật từ BE nếu đã tồn tại, id tạm (client-side) nếu mới thêm chưa lưu */
  id: string;
  optionLabel: string;
  optionContent: string;
  isCorrect: boolean;
  isNew: boolean;
}

/** 1 câu hỏi trắc nghiệm trong modal — với Reading, 1 đoạn văn có thể có NHIỀU block như thế này,
 *  mỗi block sinh ra đúng 1 ApiExamQuestion riêng khi lưu (BE không có khái niệm "nhóm câu hỏi"). */
interface QuestionBlock {
  blockId: string;
  text: string;
  points: number;
  options: EditableOption[];
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
/** Đề thi dùng thang điểm 10 — tổng Max Points của mọi câu hỏi phải bằng đúng 10. */
const TOTAL_POINTS_SCALE = 10;

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

function newBlock(points: number): QuestionBlock {
  return { blockId: tempId(), text: '', points, options: emptyOptions() };
}

// ─── Modal ────────────────────────────────────────────────────────────────

interface ModalProps {
  examId: string;
  displayOrder: number;
  initial?: ApiExamQuestion;
  /** Tổng điểm của các câu hỏi KHÁC (không tính câu đang sửa) — dùng để tính điểm tối đa còn lại
   *  cho câu hỏi này, đảm bảo tổng toàn bài không vượt quá TOTAL_POINTS_SCALE. */
  otherQuestionsPoints: number;
  onClose: () => void;
  onSaved: () => void;
}

function QuestionModal({ examId, displayOrder, initial, otherQuestionsPoints, onClose, onSaved }: ModalProps) {
  const toast = useToast();
  const isEdit = !!initial;
  const initialParsed = initial ? getPassageAndQuestion(initial) : null;

  const [questionType, setQuestionType] = useState<QuestionType>(() => {
    const match = QUESTION_TYPES.find((t) => t.value.toLowerCase() === initial?.questionType.toLowerCase());
    return match?.value ?? 'MCQ';
  });
  const [passage, setPassage] = useState(initialParsed?.passage ?? '');
  const remainingPoints = Math.max(0, TOTAL_POINTS_SCALE - otherQuestionsPoints);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [imageError, setImageError] = useState(false);
  const [audioUrl, setAudioUrl] = useState(initial?.audioUrl ?? '');
  const [saving, setSaving] = useState(false);

  const [blocks, setBlocks] = useState<QuestionBlock[]>(() => {
    if (initial) {
      return [{
        blockId: initial.id,
        text: initialParsed?.question ?? initial.questionContent,
        points: initial.points,
        options: initial.options.map((o) => ({
          id: o.id, optionLabel: o.optionLabel, optionContent: o.optionContent,
          isCorrect: !!o.isCorrect, isNew: false,
        })),
      }];
    }
    // Gợi ý sẵn đúng số điểm còn thiếu để đạt tổng 10 — admin chỉnh giảm nếu còn định thêm câu khác.
    return [newBlock(remainingPoints)];
  });

  const isReading = questionType === 'Reading';
  // Chỉ cho thêm nhiều câu hỏi con khi đang TẠO MỚI 1 đoạn Reading — sửa 1 câu đã lưu luôn thao tác
  // trên đúng 1 ApiExamQuestion, không đổi số lượng câu hỏi thật trong DB.
  const allowMultipleBlocks = isReading && !isEdit;
  const totalBlockPoints = blocks.reduce((sum, b) => sum + b.points, 0);

  const updateBlock = (blockId: string, updater: (b: QuestionBlock) => QuestionBlock) =>
    setBlocks((prev) => prev.map((b) => (b.blockId === blockId ? updater(b) : b)));

  const addBlock = () => setBlocks((prev) => [...prev, newBlock(0)]);
  const removeBlock = (blockId: string) =>
    setBlocks((prev) => (prev.length > 1 ? prev.filter((b) => b.blockId !== blockId) : prev));

  const updateOptionText = (blockId: string, optId: string, val: string) =>
    updateBlock(blockId, (b) => ({ ...b, options: b.options.map((o) => (o.id === optId ? { ...o, optionContent: val } : o)) }));

  const setCorrectOption = (blockId: string, optId: string) =>
    updateBlock(blockId, (b) => ({ ...b, options: b.options.map((o) => ({ ...o, isCorrect: o.id === optId })) }));

  const addOption = (blockId: string) =>
    updateBlock(blockId, (b) => (b.options.length >= MAX_OPTIONS ? b : ({
      ...b,
      options: [...b.options, { id: tempId(), optionLabel: letter(b.options.length), optionContent: '', isCorrect: false, isNew: true }],
    })));

  const removeOption = (blockId: string, optId: string) =>
    updateBlock(blockId, (b) => {
      if (b.options.length <= MIN_OPTIONS) return b;
      const next = b.options.filter((o) => o.id !== optId);
      if (!next.some((o) => o.isCorrect) && next.length > 0) next[0].isCorrect = true;
      return { ...b, options: next.map((o, i) => ({ ...o, optionLabel: letter(i) })) };
    });

  const handleSave = async () => {
    if (isReading && !passage.trim()) { toast.warning('Required', 'Enter the reading passage.'); return; }
    for (const b of blocks) {
      if (!b.text.trim()) { toast.warning('Required', 'Enter question text for every question.'); return; }
      if (b.options.some((o) => !o.optionContent.trim())) { toast.warning('Required', 'All options must be filled in.'); return; }
      if (!b.options.some((o) => o.isCorrect)) { toast.warning('Required', 'Mark one option as correct for every question.'); return; }
      if (b.points < 0) { toast.warning('Invalid', 'Points must be 0 or more.'); return; }
    }
    if (totalBlockPoints > remainingPoints) {
      toast.warning('Invalid', `Total points (${totalBlockPoints}) cannot exceed ${remainingPoints} — the exam uses a 10-point scale and other questions already total ${otherQuestionsPoints}.`);
      return;
    }

    setSaving(true);
    try {
      if (isEdit && initial) {
        const block = blocks[0];
        // Reading: dùng bảng reading_passages thật — sửa PassageText ở đây đồng bộ NGAY cho mọi
        // câu hỏi khác cùng trỏ tới passageId này. Câu hỏi Reading cũ (tạo trước khi BE có bảng
        // riêng, chưa có passageId) được "nâng cấp" luôn tại đây: tạo 1 passage mới rồi gắn vào.
        let passageId: string | null = null;
        if (isReading) {
          passageId = initial.passageId
            ? (await updateReadingPassage(initial.passageId, passage.trim())).id
            : (await createReadingPassage(examId, passage.trim())).id;
        }

        await updateExamQuestion(initial.id, {
          passageId,
          questionType,
          questionContent: block.text.trim(),
          imageUrl: imageUrl.trim() || null,
          audioUrl: audioUrl.trim() || null,
          points: block.points,
          displayOrder: initial.displayOrder,
        });

        // Diff options: xoá option cũ bị bỏ, tạo option mới, cập nhật option còn lại.
        const originalIds = new Set(initial.options.map((o) => o.id));
        const currentExistingIds = new Set(block.options.filter((o) => !o.isNew).map((o) => o.id));
        const removedIds = [...originalIds].filter((id) => !currentExistingIds.has(id));

        await Promise.all([
          ...removedIds.map((id) => deleteQuestionOption(id)),
          ...block.options.map((o) => {
            const payload = { optionLabel: o.optionLabel, optionContent: o.optionContent.trim(), isCorrect: o.isCorrect };
            return o.isNew
              ? createQuestionOption(initial.id, payload)
              : updateQuestionOption(o.id, payload);
          }),
        ]);

        toast.success('Updated', 'Question updated.');
      } else {
        // Reading: tạo đúng 1 passage dùng chung, rồi tạo từng câu hỏi con trỏ tới cùng passageId đó.
        const passageId = isReading ? (await createReadingPassage(examId, passage.trim())).id : null;

        await Promise.all(blocks.map((block, i) =>
          createExamQuestion({
            examSlotId: examId,
            passageId,
            questionType,
            questionContent: block.text.trim(),
            imageUrl: imageUrl.trim() || null,
            audioUrl: audioUrl.trim() || null,
            points: block.points,
            displayOrder: displayOrder + i,
            options: block.options.map((o) => ({
              optionLabel: o.optionLabel,
              optionContent: o.optionContent.trim(),
              isCorrect: o.isCorrect,
            })),
          }),
        ));
        toast.success(
          'Added',
          blocks.length > 1 ? `Reading passage added with ${blocks.length} questions.` : 'Question added.',
        );
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
      <div className="bg-navy-card border border-border rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-syne font-bold text-white-soft text-lg">
            {isEdit ? 'Edit Question' : isReading ? 'Add Reading Passage' : 'Add Question'}
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
              {SELECTABLE_QUESTION_TYPES.map(({ value, label }) => (
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
          </div>

          {/* Reading passage */}
          {isReading && (
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                Reading Passage * <span className="normal-case font-normal">— every question below refers to this text</span>
              </label>
              <textarea
                rows={6}
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                placeholder="Paste or write the reading passage here…"
                className="w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/50 transition-colors resize-y"
              />
              {isEdit && (
                <p className="mt-1.5 text-[11px] text-muted">
                  Saving here updates the shared passage — every other question from the same passage will show the new text too.
                </p>
              )}
            </div>
          )}

          {/* Image URL — shared across every question in this modal */}
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

          {/* Question blocks */}
          <div className="space-y-4">
            {isReading && (
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider">
                Questions about this passage
              </label>
            )}
            {blocks.map((block, bi) => (
              <div
                key={block.blockId}
                className={allowMultipleBlocks ? 'bg-navy/40 border border-border rounded-xl p-4 space-y-4' : 'space-y-4'}
              >
                {allowMultipleBlocks && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-bright">Question {bi + 1}</span>
                    {blocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBlock(block.blockId)}
                        className="text-muted hover:text-red transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1 text-xs"
                      >
                        <FiTrash2 size={12} /> Remove
                      </button>
                    )}
                  </div>
                )}

                {/* Question text */}
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Question *</label>
                  <textarea
                    rows={2}
                    value={block.text}
                    onChange={(e) => updateBlock(block.blockId, (b) => ({ ...b, text: e.target.value }))}
                    placeholder="Enter question text..."
                    className="w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/50 transition-colors resize-none"
                  />
                </div>

                {/* Points */}
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Max Points <span className="normal-case font-normal">(awarded automatically when the student's answer is correct)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={block.points}
                    onChange={(e) => updateBlock(block.blockId, (b) => ({ ...b, points: Number(e.target.value) }))}
                    className="w-32 bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>

                {/* Options */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider">
                      Options * <span className="normal-case font-normal">— click a letter to mark correct</span>
                    </label>
                    <span className="text-[10px] text-muted">{block.options.length}/{MAX_OPTIONS}</span>
                  </div>

                  <div className="space-y-2.5">
                    {block.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setCorrectOption(block.blockId, opt.id)}
                          className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                            opt.isCorrect ? 'border-green bg-green/20 text-green' : 'border-border text-muted hover:border-blue-bright/40'
                          }`}
                        >
                          {opt.optionLabel}
                        </button>
                        <input
                          type="text"
                          value={opt.optionContent}
                          onChange={(e) => updateOptionText(block.blockId, opt.id, e.target.value)}
                          placeholder={`Option ${opt.optionLabel}`}
                          className="flex-1 bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/50 transition-colors"
                        />
                        {opt.isCorrect && (
                          <span className="text-[10px] font-bold text-green shrink-0 w-14">✓ Correct</span>
                        )}
                        {block.options.length > MIN_OPTIONS ? (
                          <button type="button" onClick={() => removeOption(block.blockId, opt.id)}
                            className="shrink-0 w-6 h-6 rounded-full text-muted hover:text-red hover:bg-red/10 flex items-center justify-center transition-colors cursor-pointer">
                            <FiX size={12} />
                          </button>
                        ) : (
                          <span className="w-6 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                  {block.options.length < MAX_OPTIONS && (
                    <button type="button" onClick={() => addOption(block.blockId)}
                      className="mt-3 flex items-center gap-2 text-xs text-blue-bright hover:text-blue-bright/80 transition-colors cursor-pointer bg-transparent border-none">
                      <FiPlus size={13} /> Add option
                    </button>
                  )}
                </div>
              </div>
            ))}

            {allowMultipleBlocks && (
              <button
                type="button"
                onClick={addBlock}
                className="w-full py-2.5 rounded-xl border border-dashed border-blue-bright/30 text-blue-bright text-sm font-semibold cursor-pointer hover:bg-blue-bright/5 transition-colors bg-transparent flex items-center justify-center gap-2"
              >
                <FiPlus size={14} /> Add another question about this passage
              </button>
            )}

            <p className={`text-[11px] ${totalBlockPoints > remainingPoints ? 'text-red' : 'text-muted'}`}>
              {blocks.length > 1 ? `Total for this passage: ${totalBlockPoints} pts. ` : ''}
              {remainingPoints} point{remainingPoints !== 1 ? 's' : ''} remaining out of {TOTAL_POINTS_SCALE} (other questions total {otherQuestionsPoints}).
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent disabled:opacity-50">
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : blocks.length > 1 ? `Add Passage (${blocks.length} questions)` : 'Add Question'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Question card (1 câu hỏi trắc nghiệm, dùng lại cho cả câu thường và câu con của Reading) ──

function QuestionCard({
  q, index, isLocked, onEdit, onDelete,
}: {
  q: ApiExamQuestion; index: number; isLocked: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const { question: questionText } = getPassageAndQuestion(q);
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted bg-navy border border-border px-2 py-0.5 rounded-full font-mono">
            Q{index + 1}
          </span>
          <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full">
            {q.points} pt{q.points !== 1 ? 's' : ''}
          </span>
        </div>
        {!isLocked && (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-blue-bright transition-colors cursor-pointer">
              <FiEdit2 size={14} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red/10 text-muted hover:text-red transition-colors cursor-pointer">
              <FiTrash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-white-soft font-medium leading-relaxed mb-4">{questionText}</p>

      {q.imageUrl && (
        <img
          src={q.imageUrl}
          alt={`Question ${index + 1}`}
          className="w-full max-h-60 object-contain rounded-xl border border-border bg-navy mb-4"
        />
      )}

      {q.audioUrl && (
        <audio controls src={q.audioUrl} className="w-full h-10 mb-4" />
      )}

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
    </div>
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
  // BE (ExamQuestionService.EnsureExamQuestionsCanBeEdited) chỉ cho tạo/sửa/xoá câu hỏi khi exam
  // slot còn "Scheduled" (chưa tới giờ bắt đầu) — khoá y hệt ở FE để không bấm xong mới thấy lỗi.
  const isLocked = !!slot && slot.status !== 'scheduled';

  const { data, loading, error, reload } = useAsyncData(
    () => (examId ? fetchExamQuestions(examId, { pageSize: 200 }) : Promise.resolve({ items: [] as ApiExamQuestion[], pagination: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 } })),
    [examId],
  );
  const questions = [...(data?.items ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const editingPoints = modal === 'edit' && editing ? editing.points : 0;
  const otherQuestionsPoints = totalPoints - editingPoints;
  const groups = groupQuestionsByPassage(questions);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExamQuestion(deleteTarget.id);
      // Dọn passage mồ côi — nếu đây là câu hỏi Reading cuối cùng trỏ tới đoạn văn đó, xoá luôn
      // passage (BE chặn xoá passage nếu còn câu hỏi khác trỏ tới, nên gọi lại an toàn ở đây).
      if (deleteTarget.passageId) {
        const stillReferenced = questions.some((q) => q.id !== deleteTarget.id && q.passageId === deleteTarget.passageId);
        if (!stillReferenced) await deleteReadingPassage(deleteTarget.passageId).catch(() => undefined);
      }
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
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(null); setModal('create'); }}
                disabled={!examId || isLocked}
                title={isLocked ? 'Questions can only be added before the exam starts.' : undefined}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue text-white rounded-xl text-sm font-semibold hover:bg-blue/80 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiPlus /> Add Question
              </button>
            </div>
            <div className="flex gap-3">
              <div className="bg-navy-card border border-border rounded-xl px-4 py-2.5 text-sm text-muted">
                <span className="font-bold text-white-soft">{questions.length}</span> question{questions.length !== 1 ? 's' : ''}
              </div>
              <div className={`bg-navy-card border rounded-xl px-4 py-2.5 text-sm font-semibold ${
                totalPoints === TOTAL_POINTS_SCALE ? 'border-green/30 text-green' : 'border-gold/30 text-gold'
              }`}>
                Total: {totalPoints} / {TOTAL_POINTS_SCALE} pts
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLocked && (
        <div className="flex items-center gap-3 bg-gold/5 border border-gold/20 rounded-xl px-4 py-3 text-sm text-gold">
          <span className="text-lg">🔒</span>
          <span>
            This exam has {slot!.status === 'ongoing' ? 'already started' : slot!.status === 'completed' ? 'ended' : 'been cancelled'} —
            questions can no longer be added, edited, or deleted.
          </span>
        </div>
      )}

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
          <p className="text-muted text-sm">
            {isLocked ? 'No questions were added before this exam started.' : 'No questions yet. Click "Add Question" to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            let running = 0;
            return groups.map((group, gi) => {
              const startIndex = running;
              running += group.items.length;

              if (group.passage === null) {
                const q = group.items[0];
                return (
                  <div key={q.id} className="bg-navy-card border border-border rounded-[20px] p-5">
                    <QuestionCard
                      q={q}
                      index={startIndex}
                      isLocked={isLocked}
                      onEdit={() => { setEditing(q); setModal('edit'); }}
                      onDelete={() => setDeleteTarget(q)}
                    />
                  </div>
                );
              }

              return (
                <div key={`passage-${gi}`} className="bg-navy-card border border-blue-bright/20 rounded-[20px] overflow-hidden">
                  <div className="px-5 py-4 bg-blue-bright/5 border-b border-blue-bright/20 flex items-start gap-3">
                    <FiBookOpen className="text-blue-bright shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-blue-bright uppercase tracking-wider mb-1.5">
                        Reading Passage — {group.items.length} question{group.items.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-white-soft/90 leading-relaxed whitespace-pre-wrap">{group.passage}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {group.items.map((q, i) => (
                      <div key={q.id} className="p-5">
                        <QuestionCard
                          q={q}
                          index={startIndex + i}
                          isLocked={isLocked}
                          onEdit={() => { setEditing(q); setModal('edit'); }}
                          onDelete={() => setDeleteTarget(q)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && examId && (
        <QuestionModal
          examId={examId}
          displayOrder={questions.length}
          initial={modal === 'edit' && editing ? editing : undefined}
          otherQuestionsPoints={otherQuestionsPoints}
          onClose={() => { setModal(null); setEditing(null); }}
          onSaved={reload}
        />
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-card border border-border rounded-[20px] shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-syne font-bold text-white-soft">Delete Question?</h3>
            <p className="text-sm text-muted leading-relaxed break-all">
              {(() => {
                const t = getPassageAndQuestion(deleteTarget).question;
                return `"${t.slice(0, 80)}${t.length > 80 ? '…' : ''}"`;
              })()}
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
