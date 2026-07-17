import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchExamQuestions } from '../../../services/schoolAdminApi';
import type { ApiExamQuestion } from '../../../types/api';

export default function ExamQuestionsViewPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useAsyncData(
    () => (examId ? fetchExamQuestions(examId, { pageSize: 200 }) : Promise.resolve({ items: [] as ApiExamQuestion[], pagination: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 } })),
    [examId],
  );
  const questions = [...(data?.items ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const examName = questions[0]?.examName ?? `Exam ${examId?.slice(0, 8) ?? ''}…`;

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

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-navy-card border border-border rounded-[20px] h-32 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-red/30 rounded-[20px] py-16 text-center">
          <p className="text-red text-sm">{error}</p>
        </div>
      ) : questions.length === 0 ? (
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
                  <p className="text-sm text-white-soft leading-relaxed">{q.questionContent}</p>
                </div>
                <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full shrink-0">
                  {q.points} pt{q.points !== 1 ? 's' : ''}
                </span>
              </div>

              {q.imageUrl && (
                <img
                  src={q.imageUrl}
                  alt={`Question ${idx + 1}`}
                  className="w-full max-h-60 object-contain rounded-xl border border-border/50 bg-navy/40"
                />
              )}

              {/* Options */}
              {q.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                        opt.isCorrect
                          ? 'border-green/30 bg-green/10 text-green font-semibold'
                          : 'border-border/50 bg-navy/40 text-muted'
                      }`}
                    >
                      <span className={`text-[11px] font-bold w-5 text-center shrink-0 ${opt.isCorrect ? 'text-green' : 'text-muted'}`}>
                        {opt.optionLabel}
                      </span>
                      <span className="flex-1 leading-snug">{opt.optionContent || <em className="opacity-40">—</em>}</span>
                      {opt.isCorrect && <FiCheck className="text-green shrink-0 text-xs" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
