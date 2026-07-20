import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FiAlertTriangle, FiCamera, FiCheck, FiClock, FiFlag } from 'react-icons/fi';
import { useAiProctoring } from '../../../ai/hooks/useAiProctoring';
import type { ViolationType } from '../../../ai/types/proctoring';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  createExamParticipation,
  fetchExamParticipations,
  fetchExamQuestions,
  joinExamParticipation,
  sendExamHeartbeat,
  submitExamParticipation,
  submitStudentExamRecord,
} from '../../../services/schoolAdminApi';
import type { ApiExamQuestion } from '../../../types/api';

// ─── Submit Modal ─────────────────────────────────────────────────────────

function SubmitModal({ total, answered, onConfirm, onCancel }: {
  total: number; answered: number;
  onConfirm: () => void; onCancel: () => void;
}) {
  const unanswered = total - answered;
  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-7 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/30 grid place-items-center mx-auto">
          <FiFlag className="text-gold text-2xl" />
        </div>
        <div>
          <h2 className="font-syne font-bold text-white-soft text-xl mb-2">Submit Exam?</h2>
          {unanswered > 0 ? (
            <p className="text-muted text-sm">You have <span className="text-gold font-bold">{unanswered} unanswered</span> question{unanswered > 1 ? 's' : ''}. Are you sure you want to submit?</p>
          ) : (
            <p className="text-muted text-sm">You've answered all <strong className="text-green">{total} questions</strong>. Ready to submit?</p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/60 transition-colors bg-transparent">
            Keep Working
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none">
            Submit Now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Result Screen ─────────────────────────────────────────────────────────
// BE chấm điểm server-side và không trả về đáp án đúng/sai từng câu (chỉ finalScore tổng),
// nên màn hình này không thể tự đếm Correct/Wrong như trước nữa.

function ResultScreen({
  examName, answeredCount, totalQuestions, totalSeconds, maxScore, finalScore, submitting, submitError, onExit,
}: {
  examName: string;
  answeredCount: number;
  totalQuestions: number;
  totalSeconds: number;
  maxScore: number;
  finalScore: number | null;
  submitting: boolean;
  submitError: string | null;
  onExit: () => void;
}) {
  const timeTaken = Math.round(totalSeconds / 60);

  if (submitting) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-blue-bright/30 border-t-blue-bright rounded-full animate-spin mx-auto" />
          <p className="text-muted text-sm">Submitting your exam…</p>
        </div>
      </div>
    );
  }

  if (submitError) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-4xl">⚠️</p>
          <h2 className="font-syne font-bold text-white-soft text-xl">Submission Failed</h2>
          <p className="text-muted text-sm">{submitError}</p>
          <button onClick={onExit} className="px-6 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none">
            Back to My Exams
          </button>
        </div>
      </div>
    );
  }

  const hasScore = finalScore !== null && maxScore > 0;
  const pct = hasScore ? Math.round((finalScore! / maxScore) * 100) : 0;
  const scoreColor = pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const scoreTextClass = pct >= 70 ? 'text-green' : pct >= 50 ? 'text-gold' : 'text-red';
  const scoreBgClass  = pct >= 70 ? 'bg-green/10 border-green/30' : pct >= 50 ? 'bg-gold/10 border-gold/30' : 'bg-red/10 border-red/30';

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6 text-center">
        {/* Score ring */}
        <div className="relative w-36 h-36 mx-auto">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
            {hasScore && (
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
                style={{ transition: 'stroke-dashoffset 1.2s ease' }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-syne font-extrabold text-3xl text-white-soft">{hasScore ? `${pct}%` : '—'}</span>
            {hasScore && <span className="text-xs text-muted">{finalScore}/{maxScore} pts</span>}
          </div>
        </div>

        {hasScore && (
          <div className={`inline-flex items-baseline gap-1.5 px-5 py-2.5 rounded-2xl border mx-auto ${scoreBgClass}`}>
            <span className={`font-syne font-extrabold text-4xl ${scoreTextClass}`}>{finalScore}</span>
            <span className={`font-syne font-bold text-lg ${scoreTextClass} opacity-60`}>/&nbsp;{maxScore}</span>
          </div>
        )}

        <div>
          <h1 className="font-syne font-extrabold text-white-soft text-2xl">
            {hasScore ? (pct >= 70 ? 'Great Job!' : pct >= 50 ? 'Almost There' : 'Keep Practicing') : 'Exam Submitted'}
          </h1>
          <p className="text-muted text-sm mt-1">{examName}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Answered', value: `${answeredCount}/${totalQuestions}`, color: 'text-blue-bright' },
            { label: 'Time',     value: `${timeTaken}m`,                     color: 'text-gold' },
            { label: 'Score',    value: hasScore ? `${finalScore}/${maxScore}` : 'Pending', color: 'text-green' },
          ].map((s) => (
            <div key={s.label} className="bg-navy-card border border-border rounded-2xl p-4">
              <p className={`font-syne font-extrabold text-xl ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onExit}
          className="w-full py-3 rounded-2xl bg-blue text-white font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
        >
          Back to My Exams
        </button>
      </div>
    </div>
  );
}

// ─── Violation helpers ────────────────────────────────────────────────────

const VIOLATION_LABEL: Record<ViolationType, string> = {
  ABSENCE:         'Face Not Detected',
  MULTIPLE_FACE:   'Multiple Faces',
  FACE_OBSTRUCTED: 'Face Obstructed',
  HEAD_TURN:       'Head Turned',
  EYE_DIVERSION:   'Eye Diversion',
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentExamTakingPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const exam = (() => {
    try { return JSON.parse(localStorage.getItem(`studentExam_${examId}`) ?? '{}'); } catch { return {}; }
  })();

  const { data: questionsData, loading: loadingQuestions } = useAsyncData(
    () => (examId ? fetchExamQuestions(examId, { pageSize: 200 }) : Promise.resolve({ items: [] as ApiExamQuestion[], pagination: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 } })),
    [examId],
  );
  const questions = [...(questionsData?.items ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const participationIdRef = useRef<string | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const totalSeconds = (exam.durationMinutes ?? 60) * 60;
  const remaining = totalSeconds - elapsedSeconds;
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef(Date.now());

  const proctoring = useAiProctoring(videoRef);
  const { cameraStatus, evidence, violations, isRunning, start: startProctoring } = proctoring;
  const proctoringRef = useRef(proctoring);
  proctoringRef.current = proctoring;

  // Tạo / lấy ExamParticipation → gọi /join → start proctoring
  useEffect(() => {
    if (!examId || !user?.id) return;
    const studentId = user.id;
    const sessionId = examId;

    const init = async () => {
      let participationId: string | null = null;

      try {
        const p = await createExamParticipation({ examSlotId: examId, studentId });
        participationId = p.id;
      } catch {
        try {
          const { items } = await fetchExamParticipations(examId, { pageSize: 100 });
          // Lọc thêm examSlotId ở FE vì BE hiện chưa filter theo examSlotId (trả về participation của mọi bài thi)
          const existing = items.find((p) => p.examSlotId === examId && p.studentId === studentId);
          if (existing) participationId = existing.id;
        } catch { /* bỏ qua */ }
      }

      if (participationId) {
        participationIdRef.current = participationId;
        // Gọi /join để BE ghi actualStart (chỉ set lần đầu, các lần join lại sau giữ nguyên) và chuyển status → Joined
        try { await joinExamParticipation(participationId); } catch { /* không chặn thi nếu fail */ }

        // Đồng bộ đồng hồ đếm ngược theo actualStart thật từ BE — để khi thoát ra vào lại,
        // thời gian còn lại tính đúng từ lúc bắt đầu làm bài, không bị reset về đủ giờ.
        try {
          const { items } = await fetchExamParticipations(examId, { pageSize: 100 });
          const mine = items.find((p) => p.examSlotId === examId && p.studentId === studentId);
          if (mine?.actualStart) {
            startTimeRef.current = new Date(mine.actualStart).getTime();
            // Clamp về 0 — đồng hồ máy client có thể lệch (chậm hơn) so với server lúc BE ghi actualStart,
            // khiến Date.now() - startTimeRef.current ra số âm trong vài giây đầu.
            setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));
          }
        } catch { /* giữ nguyên mốc local nếu không lấy được actualStart */ }

        proctoringRef.current.updateProctoringConfig({ participationId, studentId, sessionId });
      }

      void proctoringRef.current.start();
    };

    void init();

    // Heartbeat mỗi 30s để báo student còn online
    const heartbeatTimer = setInterval(() => {
      if (participationIdRef.current) {
        void sendExamHeartbeat(participationIdRef.current).catch(() => undefined);
      }
    }, 30_000);

    return () => {
      proctoringRef.current.stop();
      clearInterval(heartbeatTimer);
    };
  }, [examId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer
  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [submitted]);

  // Nộp bài: đóng participation (dừng proctoring) + gửi đáp án cho BE chấm điểm
  const doSubmit = useCallback(async () => {
    if (!examId || submitted) return;
    setShowSubmit(false);
    setSubmitted(true);
    setSubmitting(true);
    setSubmitError(null);

    const pid = participationIdRef.current;
    const answerList = Object.entries(answersRef.current).map(([questionId, optionId]) => ({ questionId, optionId }));

    try {
      const record = await submitStudentExamRecord({
        examSlotId: examId,
        answers: answerList,
        durationSeconds: Math.max(0, elapsedSeconds),
      });
      if (pid) void submitExamParticipation(pid).catch(() => undefined);
      setFinalScore(record.finalScore ?? null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit exam.');
    } finally {
      setSubmitting(false);
    }
  }, [examId, submitted, elapsedSeconds]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (!submitted && !loadingQuestions && questions.length > 0 && remaining <= 0) {
      void doSubmit();
    }
  }, [remaining, submitted, loadingQuestions, questions.length, doSubmit]);

  const formatTime = useCallback((secs: number) => {
    if (secs <= 0) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const handleAnswer = (optId: string) => {
    setAnswers((prev) => ({ ...prev, [questions[current].id]: optId }));
  };

  if (loadingQuestions) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-blue-bright/30 border-t-blue-bright rounded-full animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-4xl">📭</p>
          <h2 className="font-syne font-bold text-white-soft text-xl">No Questions Found</h2>
          <p className="text-muted text-sm">The school admin hasn't added questions to this exam yet.</p>
          <button onClick={() => navigate('/student/exams')} className="px-6 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none">
            Back to My Exams
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  if (submitted) {
    return (
      <ResultScreen
        examName={exam.examName ?? 'Exam'}
        answeredCount={answeredCount}
        totalQuestions={questions.length}
        totalSeconds={elapsedSeconds}
        maxScore={maxScore}
        finalScore={finalScore}
        submitting={submitting}
        submitError={submitError}
        onExit={() => navigate('/student/exams')}
      />
    );
  }

  const q = questions[current];
  const isLowTime = remaining <= 300;

  return (
    <div className="h-screen bg-navy flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-navy-card border-b border-border gap-4">
        {/* Exam name */}
        <div className="min-w-0">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider">In Progress</p>
          <p className="font-syne font-bold text-white-soft text-sm truncate">{exam.examName ?? 'Exam'}</p>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold text-lg ${
          isLowTime ? 'border-red/40 text-red bg-red/10 animate-pulse' : 'border-border text-white-soft bg-navy'
        }`}>
          <FiClock className={`text-sm ${isLowTime ? 'text-red' : 'text-muted'}`} />
          {formatTime(remaining)}
        </div>

        {/* Progress + submit */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted hidden sm:block">
            <span className="text-white-soft font-bold">{answeredCount}</span>/{questions.length}
          </span>
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
          >
            <FiFlag className="text-sm" /> Submit
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left panel: Question */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable area: question + options */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-3 space-y-4 custom-scrollbar">
            {/* Question header */}
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-xl bg-blue/10 border border-blue/30 text-blue-bright text-sm font-bold grid place-items-center shrink-0 mt-0.5">
                {current + 1}
              </span>
              <div className="flex-1 space-y-3">
                <p className="text-white-soft font-semibold text-base leading-relaxed">{q.questionContent}</p>
                {q.imageUrl && (
                  <img src={q.imageUrl} alt="Question" className="max-w-full max-h-56 rounded-xl border border-border object-contain" />
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {q.options.map((opt) => {
                const isSelected = answers[q.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleAnswer(opt.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left cursor-pointer transition-all group ${
                      isSelected
                        ? 'border-blue-bright bg-blue/10 shadow-[0_0_15px_rgba(99,179,237,0.15)]'
                        : 'border-border bg-navy/40 hover:border-blue-bright/40 hover:bg-navy/60'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full border-2 font-bold text-xs grid place-items-center shrink-0 transition-all ${
                      isSelected ? 'border-blue-bright bg-blue text-white' : 'border-border text-muted group-hover:border-blue-bright/50'
                    }`}>
                      {opt.optionLabel}
                    </div>
                    <span className={`text-sm transition-colors ${isSelected ? 'text-white-soft font-semibold' : 'text-muted'}`}>
                      {opt.optionContent}
                    </span>
                    {isSelected && <FiCheck className="ml-auto text-blue-bright shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation — pinned to bottom */}
          <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-border">
            <button
              onClick={() => setCurrent((c) => c - 1)}
              disabled={current === 0}
              className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold cursor-pointer hover:border-muted/60 disabled:opacity-30 transition-colors bg-transparent"
            >
              ← Previous
            </button>
            {current < questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => c + 1)}
                className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setShowSubmit(true)}
                className="flex-1 py-2.5 rounded-xl bg-green text-white text-sm font-bold cursor-pointer hover:bg-green/80 transition-colors border-none"
              >
                Submit Exam
              </button>
            )}
          </div>
        </div>

        {/* Right panel: Navigator */}
        <div className="w-[200px] shrink-0 border-l border-border bg-navy-card flex flex-col overflow-hidden hidden sm:flex">
          {/* Camera + AI Status */}
          <div className="p-3 border-b border-border shrink-0">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiCamera className="text-xs" /> Camera
            </p>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-navy border border-border">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                muted playsInline autoPlay
              />
              {cameraStatus !== 'ready' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy/90 px-2">
                  {cameraStatus === 'requesting' ? (
                    <p className="text-[10px] text-muted text-center">Requesting camera…</p>
                  ) : (
                    <>
                      <FiCamera className={`text-lg ${cameraStatus === 'blocked' ? 'text-red' : 'text-muted'}`} />
                      <p className="text-[9px] text-muted text-center leading-tight">
                        {cameraStatus === 'blocked' ? 'Camera blocked' : 'Camera off'}
                      </p>
                      <button
                        onClick={() => void startProctoring()}
                        className="text-[9px] font-semibold px-2 py-1 rounded-lg bg-blue/20 border border-blue/40 text-blue-bright cursor-pointer hover:bg-blue/30 transition-colors"
                      >
                        Restart Camera
                      </button>
                    </>
                  )}
                </div>
              )}
              {isRunning && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red animate-pulse" />}
            </div>
          </div>

          {/* Question navigator grid */}
          <div className="shrink-0 p-3 border-b border-border">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Questions</p>
            <div className="grid grid-cols-4 gap-1.5">
              {questions.map((ques, i) => {
                const isAnswered = !!answers[ques.id];
                const isCurrent = i === current;
                return (
                  <button
                    key={ques.id}
                    onClick={() => setCurrent(i)}
                    className={`w-full aspect-square rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                      isCurrent
                        ? 'bg-blue border-blue-bright text-white shadow-[0_0_8px_rgba(99,179,237,0.3)]'
                        : isAnswered
                          ? 'bg-green/10 border-green/30 text-green'
                          : 'bg-transparent border-border text-muted hover:border-blue-bright/40'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 space-y-1.5">
              {[
                { cls: 'bg-blue border-blue-bright', label: 'Current' },
                { cls: 'bg-green/10 border-green/30', label: 'Answered' },
                { cls: 'border-border', label: 'Skipped' },
              ].map(({ cls, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded border ${cls} shrink-0`} />
                  <span className="text-[10px] text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Violations */}
          {violations.length > 0 && (
            <div className="shrink-0 border-t border-border p-3">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiAlertTriangle className="text-xs text-red" /> Violations
                <span className="ml-auto font-normal text-red">{violations.length}</span>
              </p>
              <div className="space-y-1.5">
                {violations.slice(0, 4).map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.severity === 'critical' ? 'bg-red' : 'bg-gold'}`} />
                    <span className="text-[10px] text-white-soft/80 truncate">{VIOLATION_LABEL[v.type]}</span>
                  </div>
                ))}
                {violations.length > 4 && (
                  <p className="text-[9px] text-muted pl-3.5">+{violations.length - 4} more</p>
                )}
              </div>
            </div>
          )}

          {/* DEBUG: Preview original frontend Blob before upload */}
          {/* Used to compare Blob output vs uploaded Supabase video. */}
          {evidence.some((item) => item.videoObjectUrl) && (
            <div className="shrink-0 border-t border-border p-3">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                Frontend Blob Preview
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {evidence.filter((item) => item.videoObjectUrl).map((item) => (
                  <div key={item.id} className="rounded-xl overflow-hidden border border-border bg-navy/50">
                    <video
                      controls
                      preload="metadata"
                      src={item.videoObjectUrl}
                      style={{ width: '100%', maxWidth: 500 }}
                      className="block bg-black"
                    />
                    <div className="p-2 space-y-0.5">
                      <p className="text-[9px] font-bold text-cyan truncate">{item.violationType}</p>
                      <p className="text-[9px] text-muted">
                        {Math.round(item.durationMs / 1000)}s - {(item.videoSizeBytes / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <p className="text-[9px] text-muted">Upload: {item.uploadStatus}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          {isLowTime && (
            <div className="m-3 shrink-0 flex items-center gap-2 bg-red/10 border border-red/30 rounded-xl px-3 py-2">
              <FiAlertTriangle className="text-red text-xs shrink-0" />
              <p className="text-[10px] text-red font-semibold">Time running out!</p>
            </div>
          )}
        </div>
      </div>

      {showSubmit && (
        <SubmitModal
          total={questions.length}
          answered={answeredCount}
          onConfirm={() => void doSubmit()}
          onCancel={() => setShowSubmit(false)}
        />
      )}

    </div>
  );
}
