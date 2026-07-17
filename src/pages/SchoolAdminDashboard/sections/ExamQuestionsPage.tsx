import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiImage, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchExamSlots } from '../../../services/schoolAdminApi';

// ─── Types ────────────────────────────────────────────────────────────────

export interface MCQuestion {
  id: string;
  examId: string;
  text: string;
  imageBase64?: string;
  options: string[];   // min 2, no hard max
  correctIndex: number;
}

function storageKey(examId: string) { return `eduguard_exam_questions_${examId}`; }
function loadQuestions(examId: string): MCQuestion[] {
  try { return JSON.parse(localStorage.getItem(storageKey(examId)) ?? '[]'); }
  catch { return []; }
}
function saveQuestions(examId: string, qs: MCQuestion[]) {
  localStorage.setItem(storageKey(examId), JSON.stringify(qs));
}
function genId() { return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function letter(i: number) { return String.fromCharCode(65 + i); } // A B C D E F…

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

// ─── Modal ────────────────────────────────────────────────────────────────

interface ModalProps {
  examId: string;
  initial?: MCQuestion;
  onClose: () => void;
  onSave: (q: MCQuestion) => void;
}

function QuestionModal({ examId, initial, onClose, onSave }: ModalProps) {
  const toast = useToast();
  const [text, setText] = useState(initial?.text ?? '');
  const [imageBase64, setImageBase64] = useState<string | undefined>(initial?.imageBase64);
  const [options, setOptions] = useState<string[]>(initial?.options ?? ['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<number>(initial?.correctIndex ?? 0);
  const [dragging, setDragging] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateOption = (i: number, val: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  };

  const removeOption = (i: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    setCorrectIndex((prev) => {
      if (prev === i) return 0;
      if (prev > i) return prev - 1;
      return prev;
    });
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.warning('Invalid', 'Please upload an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.warning('Too large', 'Image must be under 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleSave = () => {
    if (!text.trim() && !imageBase64) { toast.warning('Required', 'Enter question text or upload an image.'); return; }
    // When image exists, text options are optional (letters shown in image)
    if (!imageBase64 && options.some((o) => !o.trim())) {
      toast.warning('Required', 'All options must be filled in.'); return;
    }
    onSave({
      id: initial?.id ?? genId(),
      examId,
      text: text.trim(),
      imageBase64,
      options: options.map((o) => o.trim()),
      correctIndex,
    });
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-[#0f172a] border border-border rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="font-syne font-extrabold text-white-soft text-lg">
            {initial ? 'Edit Question' : 'Add Question'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-white-soft transition-colors cursor-pointer">
            <FiX />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Question text */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Question text <span className="normal-case font-normal">(optional if image provided)</span>
            </label>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter question text..."
              className="w-full bg-navy border border-border rounded-xl px-4 py-2.5 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/40 transition-colors resize-none"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Question image <span className="normal-case font-normal">(optional)</span>
            </label>
            {imageBase64 ? (
              <div className="relative">
                <img src={imageBase64} alt="Question" className="w-full max-h-56 object-contain rounded-xl border border-border bg-navy" />
                <button
                  type="button"
                  onClick={() => setImageBase64(undefined)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red/80 transition-colors cursor-pointer"
                >
                  <FiX size={13} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  dragging ? 'border-blue-bright bg-blue/10' : 'border-border hover:border-blue-bright/40 hover:bg-white/5'
                }`}
              >
                <FiImage className="text-muted text-2xl" />
                <p className="text-sm text-muted">Click or drag & drop an image</p>
                <p className="text-xs text-muted/60">PNG, JPG, GIF — max 5 MB</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Options{imageBase64 ? '' : ' *'}{' '}
                <span className="normal-case font-normal">
                  {imageBase64
                    ? '— optional if shown in image, click letter to mark correct'
                    : '— click a letter to mark correct answer'}
                </span>
              </label>
              <span className="text-[10px] text-muted">{options.length}/{MAX_OPTIONS}</span>
            </div>

            <div className="space-y-2.5">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCorrectIndex(i)}
                    className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                      correctIndex === i
                        ? 'border-green bg-green/20 text-green'
                        : 'border-border text-muted hover:border-blue-bright/40'
                    }`}
                  >
                    {letter(i)}
                  </button>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={imageBase64 ? `Option ${letter(i)} (optional)` : `Option ${letter(i)}`}
                    className="flex-1 bg-navy border border-border rounded-xl px-3 py-2 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/40 transition-colors"
                  />
                  {correctIndex === i && (
                    <span className="text-[10px] font-bold text-green shrink-0 w-14">✓ Correct</span>
                  )}
                  {options.length > MIN_OPTIONS ? (
                    <button type="button" onClick={() => removeOption(i)}
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
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white-soft transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold hover:bg-blue/80 transition-all cursor-pointer">
            {initial ? 'Save Changes' : 'Add Question'}
          </button>
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

  const [questions, setQuestions] = useState<MCQuestion[]>(() => loadQuestions(examId ?? ''));
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<MCQuestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MCQuestion | null>(null);

  const { data: slotsData } = useAsyncData(async () => {
    const result = await fetchExamSlots({ page: 1, pageSize: 200 });
    return result.items;
  }, []);
  const slot = slotsData?.find((s) => s.id === examId);

  useEffect(() => {
    if (examId) saveQuestions(examId, questions);
  }, [questions, examId]);


  const handleSave = (q: MCQuestion) => {
    setQuestions((prev) =>
      modal === 'edit' ? prev.map((x) => (x.id === q.id ? q : x)) : [...prev, q],
    );
    toast.success(modal === 'edit' ? 'Updated' : 'Added', 'Question saved.');
    setModal(null);
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
    toast.success('Deleted', 'Question removed.');
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <button
          onClick={() => navigate('/school/exams')}
          className="flex items-center gap-2 text-xs text-muted hover:text-blue-bright transition-colors cursor-pointer mb-4 bg-transparent border-none"
        >
          <FiArrowLeft /> Back to Exams
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
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
            className="flex items-center gap-2 px-4 py-2.5 bg-blue text-white rounded-xl text-sm font-semibold hover:bg-blue/80 transition-all cursor-pointer shrink-0"
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
      {questions.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-muted text-sm">No questions yet. Click "Add Question" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q: MCQuestion, i: number) => (
            <div key={q.id} className="bg-navy-card border border-border rounded-[20px] p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <span className="text-[10px] font-bold text-muted bg-navy border border-border px-2 py-0.5 rounded-full font-mono">
                  Q{i + 1}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => { setEditing(q); setModal('edit'); }} className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-blue-bright transition-colors cursor-pointer">
                    <FiEdit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(q)} className="p-1.5 rounded-lg hover:bg-red/10 text-muted hover:text-red transition-colors cursor-pointer">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>

              {q.imageBase64 && (
                <img src={q.imageBase64} alt="Question" className="w-full max-h-60 object-contain rounded-xl border border-border bg-navy mb-4" />
              )}
              {q.text && (
                <p className="text-sm text-white-soft font-medium leading-relaxed mb-4">{q.text}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, j) => (
                  <div
                    key={j}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs border ${
                      j === q.correctIndex
                        ? 'border-green/40 bg-green/10 text-green font-semibold'
                        : 'border-border/50 bg-navy/40 text-muted'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      j === q.correctIndex ? 'border-green text-green' : 'border-border text-muted'
                    }`}>
                      {letter(j)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {j === q.correctIndex && <span className="shrink-0">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <QuestionModal
          examId={examId ?? ''}
          initial={modal === 'edit' && editing ? editing : undefined}
          onClose={() => { setModal(null); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-border rounded-[20px] shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-syne font-bold text-white-soft">Delete Question?</h3>
            <p className="text-sm text-muted leading-relaxed">
              {deleteTarget.text
                ? `"${deleteTarget.text.slice(0, 80)}${deleteTarget.text.length > 80 ? '…' : ''}"`
                : 'This question contains only an image.'}
            </p>
            <p className="text-xs text-red">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white-soft transition-all cursor-pointer">
                Cancel
              </button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red/90 text-white text-sm font-semibold hover:bg-red transition-all cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
