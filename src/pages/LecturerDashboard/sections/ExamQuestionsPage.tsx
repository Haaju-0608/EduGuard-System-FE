import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { createPortal } from 'react-dom';
import { useToast } from '../../../contexts/ToastContext';

// ─── Types ────────────────────────────────────────────────────────────────

export interface MCQOption {
  id: string;
  text: string;
}

export interface MCQQuestion {
  id: string;
  text: string;
  options: MCQOption[];
  correctOptionId: string;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyQuestion(): MCQQuestion {
  const opts: MCQOption[] = OPTION_LABELS.map((_, i) => ({ id: makeId(), text: '' }));
  return { id: makeId(), text: '', options: opts, correctOptionId: opts[0].id };
}

function storageKey(examId: string) {
  return `examQuestions_${examId}`;
}

function loadQuestions(examId: string): MCQQuestion[] {
  try {
    const raw = localStorage.getItem(storageKey(examId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveQuestions(examId: string, questions: MCQQuestion[]) {
  localStorage.setItem(storageKey(examId), JSON.stringify(questions));
}

// ─── Question Form Modal ──────────────────────────────────────────────────

function QuestionFormModal({
  target, onClose, onSave,
}: {
  target: MCQQuestion | null;
  onClose: () => void;
  onSave: (q: MCQQuestion) => void;
}) {
  const [form, setForm] = useState<MCQQuestion>(() => target ? structuredClone(target) : emptyQuestion());

  useEffect(() => {
    setForm(target ? structuredClone(target) : emptyQuestion());
  }, [target]);

  const isEdit = !!target;
  const inp = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted';

  const setOptionText = (optId: string, text: string) => {
    setForm((f) => ({
      ...f,
      options: f.options.map((o) => o.id === optId ? { ...o, text } : o),
    }));
  };

  const handleSave = () => {
    if (!form.text.trim()) return;
    if (form.options.some((o) => !o.text.trim())) return;
    onSave(form);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-navy-card z-10">
          <h2 className="font-syne font-bold text-white-soft text-lg">
            {isEdit ? 'Edit Question' : 'New Question'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors bg-transparent">
            <FiX />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Question text */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Question *</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="Enter your question here..."
              rows={3}
              className={`${inp} resize-none`}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider">Answer Options *</label>
            {form.options.map((opt, idx) => (
              <div key={opt.id} className="flex items-center gap-3">
                {/* Correct indicator */}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, correctOptionId: opt.id }))}
                  className={`w-8 h-8 rounded-full border-2 font-bold text-xs shrink-0 cursor-pointer transition-all ${
                    form.correctOptionId === opt.id
                      ? 'bg-green border-green text-white'
                      : 'bg-transparent border-border text-muted hover:border-green/50'
                  }`}
                  title="Mark as correct"
                >
                  {OPTION_LABELS[idx]}
                </button>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => setOptionText(opt.id, e.target.value)}
                  placeholder={`Option ${OPTION_LABELS[idx]}...`}
                  className={inp}
                />
                {form.correctOptionId === opt.id && (
                  <FiCheck className="text-green shrink-0" />
                )}
              </div>
            ))}
            <p className="text-[11px] text-muted">Click the letter button to mark the correct answer</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.text.trim() || form.options.some((o) => !o.text.trim())}
              className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none"
            >
              {isEdit ? 'Save Changes' : 'Add Question'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Question Card ─────────────────────────────────────────────────────────

function QuestionCard({
  question, index, onEdit, onDelete,
}: {
  question: MCQQuestion;
  index: number;
  onEdit: (q: MCQQuestion) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-navy-card border border-border rounded-[20px] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-blue/10 border border-blue/20 text-blue-bright text-xs font-bold grid place-items-center shrink-0 mt-0.5">
            {index + 1}
          </span>
          <p className="text-sm font-semibold text-white-soft">{question.text}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(question)}
            className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue/30 transition-all bg-transparent"
          >
            <FiEdit2 className="text-xs" />
          </button>
          <button
            onClick={() => onDelete(question.id)}
            className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-all bg-transparent"
          >
            <FiTrash2 className="text-xs" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {question.options.map((opt, i) => {
          const isCorrect = opt.id === question.correctOptionId;
          return (
            <div
              key={opt.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm ${
                isCorrect
                  ? 'border-green/30 bg-green/10 text-green font-semibold'
                  : 'border-border/50 bg-navy/40 text-muted'
              }`}
            >
              <span className={`text-[11px] font-bold w-5 text-center shrink-0 ${isCorrect ? 'text-green' : 'text-muted'}`}>
                {OPTION_LABELS[i]}
              </span>
              <span className="truncate">{opt.text}</span>
              {isCorrect && <FiCheck className="text-green shrink-0 ml-auto text-xs" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ExamQuestionsPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [questions, setQuestions] = useState<MCQQuestion[]>(() =>
    examId ? loadQuestions(examId) : [],
  );
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<MCQQuestion | null>(null);
  const [deleteQId, setDeleteQId] = useState<string | null>(null);

  // Get exam name from localStorage (set by ExamSlotsPage when navigating)
  const examName = examId
    ? (localStorage.getItem(`examName_${examId}`) ?? `Exam ${examId.slice(0, 8)}…`)
    : 'Exam';

  const persist = (updated: MCQQuestion[]) => {
    setQuestions(updated);
    if (examId) saveQuestions(examId, updated);
  };

  const handleSave = (q: MCQQuestion) => {
    const existing = questions.findIndex((x) => x.id === q.id);
    if (existing >= 0) {
      persist(questions.map((x) => x.id === q.id ? q : x));
      toast.success('Updated', 'Question updated.');
    } else {
      persist([...questions, q]);
      toast.success('Added', 'Question added.');
    }
  };

  const confirmDeleteQ = () => {
    if (!deleteQId) return;
    const id = deleteQId;
    setDeleteQId(null);
    persist(questions.filter((q) => q.id !== id));
    toast.success('Deleted', 'Question removed.');
  };

  const openEdit = (q: MCQQuestion) => { setEditTarget(q); setShowForm(true); };
  const openCreate = () => { setEditTarget(null); setShowForm(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center gap-4 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent shrink-0"
        >
          <FiArrowLeft />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-0.5">Question Bank</p>
          <h1 className="font-syne text-xl font-extrabold text-white-soft truncate">{examName}</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none shrink-0"
        >
          <FiPlus /> Add Question
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Questions', value: questions.length, color: 'text-blue-bright' },
          { label: 'Est. Duration', value: `${questions.length * 2} min`, color: 'text-gold' },
          { label: 'Max Score', value: `${questions.length * 10} pts`, color: 'text-green' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-xl ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-20 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p className="font-syne font-bold text-white-soft text-lg mb-1">No questions yet</p>
          <p className="text-muted text-sm mb-6">Start building your question bank for this exam.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
          >
            <FiPlus /> Add First Question
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionCard key={q.id} question={q} index={i} onEdit={openEdit} onDelete={setDeleteQId} />
          ))}
        </div>
      )}

      {showForm && (
        <QuestionFormModal
          target={editTarget}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      {deleteQId && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-white-soft text-base">Delete Question</h3>
                <p className="text-muted text-sm mt-1">
                  Are you sure you want to delete this question? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteQId(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteQ}
                className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-semibold cursor-pointer hover:bg-red/80 transition-colors border-none"
              >
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
