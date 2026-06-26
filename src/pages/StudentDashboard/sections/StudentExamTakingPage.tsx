import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FiAlertTriangle, FiCamera, FiCheck, FiClock, FiFlag } from 'react-icons/fi';

// ─── Types ────────────────────────────────────────────────────────────────

interface MCQOption { id: string; text: string; }
interface MCQQuestion { id: string; text: string; options: MCQOption[]; correctOptionId: string; }

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

// Mock questions used when localStorage has no questions for this exam
const MOCK_QUESTIONS: MCQQuestion[] = Array.from({ length: 10 }, (_, i) => {
  const opts = ['Option 1', 'Option 2', 'Option 3', 'Option 4'].map((t, j) => ({
    id: `q${i}opt${j}`,
    text: `${t} for Q${i + 1}`,
  }));
  return {
    id: `q${i}`,
    text: `Sample Question ${i + 1}: What is the correct answer for this question?`,
    options: opts,
    correctOptionId: opts[0].id,
  };
});

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
  const timeTaken = Math.round((totalSeconds) / 60);

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6 text-center">
        {/* Score ring */}
        <div className="relative w-36 h-36 mx-auto">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="50" fill="none"
              stroke={pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'}
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

        <div>
          <h1 className="font-syne font-extrabold text-white-soft text-2xl">{pct >= 70 ? 'Great Job!' : pct >= 50 ? 'Almost There' : 'Keep Practicing'}</h1>
          <p className="text-muted text-sm mt-1">{examName}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Correct', value: correct, color: 'text-green' },
            { label: 'Wrong', value: total - correct, color: 'text-red' },
            { label: 'Time', value: `${timeTaken}m`, color: 'text-gold' },
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

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentExamTakingPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const exam = (() => {
    try { return JSON.parse(localStorage.getItem(`studentExam_${examId}`) ?? '{}'); } catch { return {}; }
  })();

  const storedQs = (() => {
    try {
      const raw = localStorage.getItem(`examQuestions_${examId}`);
      const parsed: MCQQuestion[] = raw ? JSON.parse(raw) : [];
      return parsed.length > 0 ? parsed : MOCK_QUESTIONS;
    } catch { return MOCK_QUESTIONS; }
  })();

  const [questions] = useState<MCQQuestion[]>(storedQs);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  const totalSeconds = (exam.durationMinutes ?? 60) * 60;
  const remaining = totalSeconds - elapsedSeconds;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(Date.now());

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
    if (!submitted && remaining <= 0) { setSubmitted(true); }
  }, [remaining, submitted]);

  // Camera
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 160, height: 120 }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; }
        setCameraReady(true);
      })
      .catch(() => setCameraReady(false));
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

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
  };

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
    <div className="min-h-screen bg-navy flex flex-col overflow-hidden">
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
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Question */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-6 min-w-0">
          {/* Question header */}
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue/10 border border-blue/30 text-blue-bright text-sm font-bold grid place-items-center shrink-0 mt-0.5">
              {current + 1}
            </span>
            <p className="text-white-soft font-semibold text-base leading-relaxed">{q.text}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = answers[q.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleAnswer(opt.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border text-left cursor-pointer transition-all group ${
                    isSelected
                      ? 'border-blue-bright bg-blue/10 shadow-[0_0_15px_rgba(99,179,237,0.15)]'
                      : 'border-border bg-navy/40 hover:border-blue-bright/40 hover:bg-navy/60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 font-bold text-sm grid place-items-center shrink-0 transition-all ${
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

          {/* Navigation */}
          <div className="flex justify-between gap-3 mt-auto pt-4">
            <button
              onClick={() => setCurrent((c) => c - 1)}
              disabled={current === 0}
              className="flex-1 py-3 rounded-xl border border-border text-muted text-sm font-semibold cursor-pointer hover:border-muted/60 disabled:opacity-30 transition-colors bg-transparent"
            >
              ← Previous
            </button>
            {current < questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => c + 1)}
                className="flex-1 py-3 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setShowSubmit(true)}
                className="flex-1 py-3 rounded-xl bg-green text-white text-sm font-bold cursor-pointer hover:bg-green/80 transition-colors border-none"
              >
                Submit Exam
              </button>
            )}
          </div>
        </div>

        {/* Right panel: Navigator */}
        <div className="w-[200px] shrink-0 border-l border-border bg-navy-card flex flex-col overflow-hidden hidden sm:flex">
          {/* Camera */}
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
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <FiCamera className="text-muted text-xl" />
                </div>
              )}
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red animate-pulse" />
            </div>
          </div>

          {/* Question navigator grid */}
          <div className="flex-1 overflow-y-auto p-3">
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
            <div className="mt-4 space-y-1.5">
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

          {/* Warning */}
          {isLowTime && (
            <div className="m-3 flex items-center gap-2 bg-red/10 border border-red/30 rounded-xl px-3 py-2">
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
