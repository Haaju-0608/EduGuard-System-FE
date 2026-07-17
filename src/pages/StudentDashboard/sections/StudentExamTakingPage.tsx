import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FiAlertTriangle, FiCamera, FiCheck, FiClock, FiFlag } from 'react-icons/fi';
import { useAiProctoring } from '../../../ai/hooks/useAiProctoring';
import type { ViolationType } from '../../../ai/types/proctoring';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createExamParticipation,
  fetchExamParticipations,
  joinExamParticipation,
  sendExamHeartbeat,
  submitExamParticipation,
} from '../../../services/schoolAdminApi';

// ─── Types ────────────────────────────────────────────────────────────────

interface MCQOption { id: string; text: string; }
interface MCQQuestion { id: string; text: string; imageBase64?: string; options: MCQOption[]; correctOptionId: string; }

// School admin format (saved by ExamQuestionsPage)
interface MCQuestion { id: string; examId: string; text: string; imageBase64?: string; options: string[]; correctIndex: number; }

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function loadExamQuestions(examId: string): MCQQuestion[] {
  try {
    const raw = localStorage.getItem(`eduguard_exam_questions_${examId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MCQuestion[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return parsed.map((q) => {
      const opts: MCQOption[] = q.options.map((text, i) => ({ id: `${q.id}_opt${i}`, text }));
      return {
        id: q.id,
        text: q.text,
        imageBase64: q.imageBase64,
        options: opts,
        correctOptionId: opts[q.correctIndex]?.id ?? opts[0].id,
      };
    });
  } catch { return []; }
}

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

function ResultScreen({ questions, answers, totalSeconds, examName, onExit }: {
  questions: MCQQuestion[];
  answers: Record<string, string>;
  totalSeconds: number;
  examName: string;
  onExit: () => void;
}) {
  const correct = questions.filter((q) => answers[q.id] === q.correctOptionId).length;
  const total = questions.length;
  const pct = Math.round((correct / total) * 100);
  const score10 = ((correct / total) * 10).toFixed(1);
  const timeTaken = Math.round((totalSeconds) / 60);

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
            <circle
              cx="60" cy="60" r="50" fill="none"
              stroke={scoreColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
              style={{ transition: 'stroke-dashoffset 1.2s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-syne font-extrabold text-3xl text-white-soft">{pct}%</span>
            <span className="text-xs text-muted">{correct}/{total}</span>
          </div>
        </div>

        {/* Score badge */}
        <div className={`inline-flex items-baseline gap-1.5 px-5 py-2.5 rounded-2xl border mx-auto ${scoreBgClass}`}>
          <span className={`font-syne font-extrabold text-4xl ${scoreTextClass}`}>{score10}</span>
          <span className={`font-syne font-bold text-lg ${scoreTextClass} opacity-60`}>/&nbsp;10</span>
        </div>

        <div>
          <h1 className="font-syne font-extrabold text-white-soft text-2xl">{pct >= 70 ? 'Great Job!' : pct >= 50 ? 'Almost There' : 'Keep Practicing'}</h1>
          <p className="text-muted text-sm mt-1">{examName}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Correct', value: correct, color: 'text-green' },
            { label: 'Wrong',   value: total - correct, color: 'text-red' },
            { label: 'Time',    value: `${timeTaken}m`, color: 'text-gold' },
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

  const [questions] = useState<MCQQuestion[]>(() => loadExamQuestions(examId ?? ''));
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const participationIdRef = useRef<string | null>(null);

  const totalSeconds = (exam.durationMinutes ?? 60) * 60;
  const remaining = totalSeconds - elapsedSeconds;
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef(Date.now());

  const proctoring = useAiProctoring(videoRef);
  const { cameraStatus, violations, isRunning, start: startProctoring } = proctoring;
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
            setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
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
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [submitted]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (!submitted && remaining <= 0) {
      setSubmitted(true);
      if (participationIdRef.current) {
        void submitExamParticipation(participationIdRef.current).catch(() => undefined);
      }
    }
  }, [remaining, submitted]);

  const formatTime = useCallback((secs: number) => {
    if (secs <= 0) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const handleAnswer = (optId: string) => {
    setAnswers((prev) => ({ ...prev, [questions[current].id]: optId }));
  };

  const handleSubmitConfirm = () => {
    setShowSubmit(false);
    setSubmitted(true);
    if (participationIdRef.current) {
      void submitExamParticipation(participationIdRef.current).catch(() => undefined);
    }
  };

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

  if (submitted) {
    return (
      <ResultScreen
        questions={questions}
        answers={answers}
        totalSeconds={elapsedSeconds}
        examName={exam.examName ?? 'Exam'}
        onExit={() => navigate('/student/exams')}
      />
    );
  }

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;
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
                {q.text && <p className="text-white-soft font-semibold text-base leading-relaxed">{q.text}</p>}
                {q.imageBase64 && (
                  <img src={q.imageBase64} alt="Question" className="max-w-full max-h-56 rounded-xl border border-border object-contain" />
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {q.options.map((opt, i) => {
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
                      {OPTION_LABELS[i]}
                    </div>
                    <span className={`text-sm transition-colors ${isSelected ? 'text-white-soft font-semibold' : 'text-muted'}`}>
                      {opt.text}
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
          onConfirm={handleSubmitConfirm}
          onCancel={() => setShowSubmit(false)}
        />
      )}

    </div>
  );
}
