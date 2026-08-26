import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiBookOpen, FiChevronRight, FiPlus, FiUpload, FiX } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  ExamQuestionSetSummary,
  fetchExamQuestionSets,
  importExamQuestionsFromExcel,
} from '../../../services/schoolAdminApi';

/** Trang quản lý "bộ đề" (question set) độc lập, tách khỏi Exam Slot — BE (commit 250a884) đổi
 *  ExamQuestion để gắn vào Institution + tên bộ đề (examQuestionName) thay vì 1 exam slot cụ thể,
 *  cho phép dùng lại 1 bộ đề cho nhiều slot. Trang này là nơi DUY NHẤT tạo được 1 bộ đề mới TRƯỚC
 *  khi có exam slot nào cả — ExamManagementPage giờ bắt SchoolAdmin CHỌN 1 bộ đề có sẵn khi tạo exam
 *  slot (không còn nhập tên tự do), nên phải có nơi tạo bộ đề độc lập với slot để phá vòng lặp này. */

const TOTAL_POINTS_SCALE = 10;

function ImportModal({ institutionId, onClose, onImported }: {
  institutionId: string;
  onClose: () => void;
  onImported: (setName: string) => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!file) { toast.warning('Required', 'Choose a .xlsx file first.'); return; }
    setImporting(true);
    try {
      const res = await importExamQuestionsFromExcel(institutionId, file);
      toast.success('Imported', `${res.importedCount} question${res.importedCount !== 1 ? 's' : ''} added to "${res.examQuestionName}".`);
      onImported(res.examQuestionName);
      onClose();
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : 'Could not import the file.');
    } finally {
      setImporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-syne font-bold text-white-soft text-lg">Import Question Set from Excel</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors">
            <FiX />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue/5 border border-blue/20 rounded-xl p-3 text-xs text-muted leading-relaxed">
            ℹ️ File <code className="text-white-soft">.xlsx</code>, max 5MB / 500 rows. Columns:{' '}
            <code className="text-white-soft">Stt, Question, A, B, C, D, Answers</code> (Answers must be A/B/C/D).
            The set's name is taken from the <span className="text-white-soft">file name</span> (without .xlsx) —
            every question imported becomes a single-choice question worth 1 point.
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-blue-bright/40 transition-colors"
          >
            <FiUpload className="text-2xl text-muted mx-auto mb-2" />
            <p className="text-sm text-white-soft">{file ? file.name : 'Click to choose a file'}</p>
            <p className="text-[11px] text-muted mt-1">.xlsx only</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-border shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing || !file}
            className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NewSetModal({ existingNames, onClose, onCreate }: {
  existingNames: Set<string>;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.warning('Required', 'Enter a name for the question set.'); return; }
    if (trimmed.length > 255) { toast.warning('Invalid', 'Name must be 255 characters or fewer.'); return; }
    if (existingNames.has(trimmed.toLowerCase())) { toast.warning('Already exists', 'A question set with this name already exists.'); return; }
    onCreate(trimmed);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-syne font-bold text-white-soft text-lg">New Question Set</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors">
            <FiX />
          </button>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
            Set Name * <span className="normal-case font-normal">({name.length}/255)</span>
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="e.g. Midterm Grammar Set"
            maxLength={255}
            className="w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted"
          />
          <p className="text-[11px] text-muted mt-1.5">You'll add the first question on the next screen.</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">
            Cancel
          </button>
          <button type="button" onClick={handleCreate} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none">
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function QuestionBankPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const [showNewSet, setShowNewSet] = useState(false);

  const { data, loading, error, reload } = useAsyncData(fetchExamQuestionSets, []);
  const sets: ExamQuestionSetSummary[] = data ?? [];
  const existingNames = new Set(sets.map((s) => s.name.toLowerCase()));

  const goToSet = (name: string) => navigate(`/school/exams/question-bank/${encodeURIComponent(name)}/questions`);

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
            <h1 className="font-syne text-2xl font-extrabold text-white-soft">Question Bank</h1>
            <p className="text-muted text-sm mt-1">
              Reusable question sets — create one here, then pick it when creating an exam slot.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowImport(true)}
              disabled={!user?.institutionId}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-cyan/30 text-cyan text-sm font-semibold cursor-pointer hover:bg-cyan/10 transition-all bg-transparent disabled:opacity-50"
            >
              <FiUpload /> Import Excel
            </button>
            <button
              onClick={() => setShowNewSet(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
            >
              <FiPlus /> New Set
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">Question Sets</p>
          <span className="text-xs text-muted">{sets.length}</span>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-1/3" />
                  <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-14 text-center space-y-3">
            <p className="text-red text-sm font-semibold">Failed to load question sets</p>
            <p className="text-muted text-xs">{error}</p>
            <button onClick={reload} className="text-blue-bright text-sm underline cursor-pointer bg-transparent border-none">Retry</button>
          </div>
        ) : sets.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-muted text-sm">No question sets yet. Import an Excel file or create one manually.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sets.map((s) => (
              <button
                key={s.name}
                onClick={() => goToSet(s.name)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-navy/40 transition-colors text-left cursor-pointer bg-transparent border-none"
              >
                <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center shrink-0">
                  <FiBookOpen className="text-blue-bright" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white-soft truncate">{s.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {s.questionCount} question{s.questionCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                  s.totalPoints === TOTAL_POINTS_SCALE ? 'text-green bg-green/10 border-green/25' : 'text-gold bg-gold/10 border-gold/25'
                }`}>
                  {s.totalPoints} / {TOTAL_POINTS_SCALE} pts
                </span>
                <FiChevronRight className="text-muted shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {showImport && user?.institutionId && (
        <ImportModal
          institutionId={user.institutionId}
          onClose={() => setShowImport(false)}
          onImported={() => void reload()}
        />
      )}

      {showNewSet && (
        <NewSetModal
          existingNames={existingNames}
          onClose={() => setShowNewSet(false)}
          onCreate={(name) => { setShowNewSet(false); goToSet(name); }}
        />
      )}
    </div>
  );
}
