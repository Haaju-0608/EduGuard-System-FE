import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiImage } from 'react-icons/fi';
import type { MCQuestion } from '../../SchoolAdminDashboard/sections/ExamQuestionsPage';

function storageKey(examId: string) { return `eduguard_exam_questions_${examId}`; }

function loadQuestions(examId: string): MCQuestion[] {
  try { return JSON.parse(localStorage.getItem(storageKey(examId)) ?? '[]'); }
  catch { return []; }
}

function letter(i: number) { return String.fromCharCode(65 + i); }

export default function ExamQuestionsViewPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [questions] = useState<MCQuestion[]>(() =>
    examId ? loadQuestions(examId) : [],
  );

  const examName = examId
    ? (localStorage.getItem(`examName_${examId}`) ?? `Exam ${examId.slice(0, 8)}…`)
    : 'Exam';

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
        <span className="text-sm text-muted bg-navy border border-border px-3 py-1.5 rounded-xl shrink-0">
          {questions.length} question{questions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Empty state */}
      {questions.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-20 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p className="font-syne font-bold text-white-soft text-lg mb-1">No questions yet</p>
          <p className="text-muted text-sm">The school admin hasn't added any questions for this exam.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-navy-card border border-border rounded-[20px] p-5 space-y-4">
              {/* Question header */}
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-blue/10 border border-blue/20 grid place-items-center text-xs font-bold text-blue-bright shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {q.text && (
                    <p className="text-sm text-white-soft leading-relaxed">{q.text}</p>
                  )}
                </div>
              </div>

              {/* Image */}
              {q.imageBase64 && (
                <div className="rounded-xl overflow-hidden border border-border/50 bg-navy/40">
                  <img
                    src={q.imageBase64}
                    alt={`Question ${idx + 1}`}
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              )}

              {/* Image placeholder when no image and no text combo */}
              {!q.imageBase64 && !q.text && (
                <div className="flex items-center gap-2 text-muted text-sm">
                  <FiImage className="text-base" />
                  <span>No question content</span>
                </div>
              )}

              {/* Options */}
              {q.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, i) => {
                    const isCorrect = i === q.correctIndex;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                          isCorrect
                            ? 'border-green/30 bg-green/10 text-green font-semibold'
                            : 'border-border/50 bg-navy/40 text-muted'
                        }`}
                      >
                        <span className={`text-[11px] font-bold w-5 text-center shrink-0 ${isCorrect ? 'text-green' : 'text-muted'}`}>
                          {letter(i)}
                        </span>
                        <span className="flex-1 leading-snug">{opt || <em className="opacity-40">—</em>}</span>
                        {isCorrect && <FiCheck className="text-green shrink-0 text-xs" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
