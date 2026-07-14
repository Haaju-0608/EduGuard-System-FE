import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';

// ─── Types ────────────────────────────────────────────────────────────────

export interface MCQuestion {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
}

const STORAGE_KEY = 'eduguard_question_bank';

function loadQuestions(): MCQuestion[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveQuestions(qs: MCQuestion[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(qs));
}

function genId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Badge helpers ─────────────────────────────────────────────────────────

const DIFF_CONFIG = {
  easy:   { label: 'Easy',   cls: 'text-green bg-green/10 border-green/25' },
  medium: { label: 'Medium', cls: 'text-gold bg-gold/10 border-gold/25' },
  hard:   { label: 'Hard',   cls: 'text-red bg-red/10 border-red/25' },
};

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

// ─── Modal ─────────────────────────────────────────────────────────────────

interface ModalProps {
  initial?: MCQuestion;
  onClose: () => void;
  onSave: (q: MCQuestion) => void;
}

const EMPTY_FORM = {
  text: '',
  options: ['', '', '', ''] as [string, string, string, string],
  correctIndex: 0 as 0 | 1 | 2 | 3,
  subject: '',
  difficulty: 'medium' as MCQuestion['difficulty'],
};

function QuestionModal({ initial, onClose, onSave }: ModalProps) {
  const [form, setForm] = useState(
    initial
      ? {
          text: initial.text,
          options: [...initial.options] as [string, string, string, string],
          correctIndex: initial.correctIndex,
          subject: initial.subject,
          difficulty: initial.difficulty,
        }
      : { ...EMPTY_FORM, options: ['', '', '', ''] as [string, string, string, string] },
  );
  const toast = useToast();

  const setOption = (i: number, val: string) =>
    setForm((f) => {
      const opts = [...f.options] as [string, string, string, string];
      opts[i] = val;
      return { ...f, options: opts };
    });

  const handleSave = () => {
    if (!form.text.trim()) { toast.warning('Required', 'Question text is required.'); return; }
    if (form.options.some((o) => !o.trim())) { toast.warning('Required', 'All 4 options must be filled in.'); return; }
    if (!form.subject.trim()) { toast.warning('Required', 'Subject is required.'); return; }
    onSave({
      id: initial?.id ?? genId(),
      text: form.text.trim(),
      options: form.options.map((o) => o.trim()) as [string, string, string, string],
      correctIndex: form.correctIndex,
      subject: form.subject.trim(),
      difficulty: form.difficulty,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  };

  const overlayRef = useRef<HTMLDivElement>(null);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-[#0f172a] border border-border rounded-[24px] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="font-syne font-extrabold text-white-soft text-lg">
            {initial ? 'Edit Question' : 'Create New Question'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-white-soft transition-colors cursor-pointer">
            <FiX />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Question text */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Question Text *
            </label>
            <textarea
              rows={3}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="Enter your question here..."
              className="w-full bg-navy border border-border rounded-xl px-4 py-2.5 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/40 transition-colors resize-none"
            />
          </div>

          {/* Options */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
              Answer Options * <span className="normal-case font-normal">(select the correct one)</span>
            </label>
            <div className="space-y-2.5">
              {OPTION_LETTERS.map((letter, i) => (
                <div key={letter} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, correctIndex: i as 0 | 1 | 2 | 3 }))}
                    className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                      form.correctIndex === i
                        ? 'border-green bg-green/20 text-green'
                        : 'border-border text-muted hover:border-blue-bright/40'
                    }`}
                  >
                    {letter}
                  </button>
                  <input
                    type="text"
                    value={form.options[i]}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${letter}`}
                    className="flex-1 bg-navy border border-border rounded-xl px-3 py-2 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/40 transition-colors"
                  />
                  {form.correctIndex === i && (
                    <span className="text-[10px] font-bold text-green shrink-0">✓ Correct</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Subject + Difficulty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Subject *</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Math, Physics..."
                className="w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft placeholder:text-muted outline-none focus:border-blue-bright/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Difficulty</label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, difficulty: d }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border capitalize cursor-pointer transition-all ${
                      form.difficulty === d
                        ? DIFF_CONFIG[d].cls
                        : 'text-muted border-border hover:border-blue-bright/30'
                    }`}
                  >
                    {DIFF_CONFIG[d].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white-soft hover:border-blue-bright/30 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold hover:bg-blue/80 transition-all cursor-pointer"
          >
            {initial ? 'Save Changes' : 'Create Question'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Question Card ──────────────────────────────────────────────────────────

function QuestionCard({
  q, index, onEdit, onDelete,
}: { q: MCQuestion; index: number; onEdit: () => void; onDelete: () => void }) {
  const diff = DIFF_CONFIG[q.difficulty];
  return (
    <div className="bg-navy-card border border-border rounded-[20px] p-5 flex flex-col gap-4">
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-muted bg-navy border border-border px-2 py-0.5 rounded-full font-mono">
            #{index + 1}
          </span>
          <span className="text-[10px] font-bold text-blue-bright bg-blue/10 border border-blue/25 px-2 py-0.5 rounded-full">
            {q.subject}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diff.cls}`}>
            {diff.label}
          </span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-blue-bright transition-colors cursor-pointer"
          >
            <FiEdit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red/10 text-muted hover:text-red transition-colors cursor-pointer"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </div>

      {/* Question text */}
      <p className="text-sm text-white-soft font-medium leading-relaxed">{q.text}</p>

      {/* Options */}
      <div className="space-y-1.5">
        {q.options.map((opt, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs border transition-colors ${
              i === q.correctIndex
                ? 'border-green/40 bg-green/10 text-green font-semibold'
                : 'border-border/50 bg-navy/40 text-muted'
            }`}
          >
            <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
              i === q.correctIndex ? 'border-green text-green' : 'border-border text-muted'
            }`}>
              {OPTION_LETTERS[i]}
            </span>
            <span>{opt}</span>
            {i === q.correctIndex && <span className="ml-auto text-[10px]">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function QuestionBankPage() {
  const toast = useToast();
  const [questions, setQuestions] = useState<MCQuestion[]>(loadQuestions);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<MCQuestion['difficulty'] | 'all'>('all');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<MCQuestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MCQuestion | null>(null);

  useEffect(() => { saveQuestions(questions); }, [questions]);

  const filtered = questions.filter((q) => {
    const s = search.toLowerCase();
    const matchSearch = !s || q.text.toLowerCase().includes(s) || q.subject.toLowerCase().includes(s);
    const matchDiff = diffFilter === 'all' || q.difficulty === diffFilter;
    return matchSearch && matchDiff;
  });

  const handleSave = (q: MCQuestion) => {
    setQuestions((prev) =>
      modal === 'edit'
        ? prev.map((x) => (x.id === q.id ? q : x))
        : [...prev, q],
    );
    toast.success(modal === 'edit' ? 'Updated' : 'Created', `Question saved successfully.`);
    setModal(null);
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
    toast.success('Deleted', 'Question deleted.');
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Question Bank</h1>
          <p className="text-muted text-sm mt-1">Manage multiple choice questions for exams.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue text-white rounded-xl text-sm font-semibold hover:bg-blue/80 transition-all cursor-pointer"
        >
          <FiPlus /> Add Question
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',  value: questions.length,                                        color: 'text-blue-bright' },
          { label: 'Easy',   value: questions.filter((q) => q.difficulty === 'easy').length,   color: 'text-green' },
          { label: 'Medium', value: questions.filter((q) => q.difficulty === 'medium').length, color: 'text-gold' },
          { label: 'Hard',   value: questions.filter((q) => q.difficulty === 'hard').length,   color: 'text-red' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[200px] bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search question or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDiffFilter(d)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all capitalize ${
                diffFilter === d
                  ? 'bg-blue text-white border-blue'
                  : 'bg-transparent text-muted border-border hover:border-blue/40'
              }`}
            >
              {d === 'all' ? 'All' : DIFF_CONFIG[d].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-muted text-sm">
            {questions.length === 0 ? 'No questions yet. Click "Add Question" to get started.' : 'No questions match your filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filtered.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              onEdit={() => { setEditing(q); setModal('edit'); }}
              onDelete={() => setDeleteTarget(q)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <QuestionModal
          initial={modal === 'edit' && editing ? editing : undefined}
          onClose={() => { setModal(null); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-border rounded-[20px] shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-syne font-bold text-white-soft text-base">Delete Question?</h3>
            <p className="text-sm text-muted leading-relaxed">
              "{deleteTarget.text.slice(0, 80)}{deleteTarget.text.length > 80 ? '…' : ''}"
            </p>
            <p className="text-xs text-red">This action cannot be undone.</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white-soft transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red/90 text-white text-sm font-semibold hover:bg-red transition-all cursor-pointer"
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
