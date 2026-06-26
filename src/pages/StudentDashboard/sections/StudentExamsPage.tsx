import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiSearch } from 'react-icons/fi';

// ─── Mock data ────────────────────────────────────────────────────────────

export interface StudentExam {
  id: string;
  examName: string;
  className: string;
  classCode: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'upcoming' | 'available' | 'completed' | 'missed';
  questionCount: number;
}

const MOCK_EXAMS: StudentExam[] = [
  {
    id: 'exam-001',
    examName: 'Midterm Exam',
    className: 'Object Oriented Programming',
    classCode: 'OP212',
    startTime: '2026-06-27T08:00:00.000Z',
    endTime: '2026-06-27T09:30:00.000Z',
    durationMinutes: 90,
    status: 'available',
    questionCount: 30,
  },
  {
    id: 'exam-002',
    examName: 'Quiz 1',
    className: 'Data Structures',
    classCode: 'DS201',
    startTime: '2026-06-28T13:00:00.000Z',
    endTime: '2026-06-28T13:45:00.000Z',
    durationMinutes: 45,
    status: 'upcoming',
    questionCount: 15,
  },
  {
    id: 'exam-003',
    examName: 'Final Exam',
    className: 'Database Systems',
    classCode: 'DB301',
    startTime: '2026-06-20T08:00:00.000Z',
    endTime: '2026-06-20T10:00:00.000Z',
    durationMinutes: 120,
    status: 'completed',
    questionCount: 40,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_CONFIG = {
  available: { label: 'Available', cls: 'text-green bg-green/10 border-green/25', dot: 'bg-green animate-pulse' },
  upcoming: { label: 'Upcoming', cls: 'text-gold bg-gold/10 border-gold/25', dot: 'bg-gold' },
  completed: { label: 'Completed', cls: 'text-muted bg-white/5 border-border', dot: 'bg-muted' },
  missed: { label: 'Missed', cls: 'text-red bg-red/10 border-red/25', dot: 'bg-red' },
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentExamsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StudentExam['status'] | 'all'>('all');

  const exams = MOCK_EXAMS.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.examName.toLowerCase().includes(q) || e.classCode.toLowerCase().includes(q) || e.className.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || e.status === filter;
    return matchSearch && matchFilter;
  });

  const handleStart = (exam: StudentExam) => {
    localStorage.setItem(`studentExam_${exam.id}`, JSON.stringify(exam));
    navigate(`/student/exams/${exam.id}/verify`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <h1 className="font-syne text-2xl font-extrabold text-white-soft">My Exams</h1>
        <p className="text-muted text-sm mt-1">View your scheduled exams and start available ones.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: MOCK_EXAMS.length, color: 'text-blue-bright' },
          { label: 'Available', value: MOCK_EXAMS.filter(e => e.status === 'available').length, color: 'text-green' },
          { label: 'Upcoming', value: MOCK_EXAMS.filter(e => e.status === 'upcoming').length, color: 'text-gold' },
          { label: 'Completed', value: MOCK_EXAMS.filter(e => e.status === 'completed').length, color: 'text-muted' },
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
            placeholder="Search exam or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'available', 'upcoming', 'completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all capitalize ${
                filter === s
                  ? 'bg-blue text-white border-blue'
                  : 'bg-transparent text-muted border-border hover:border-blue/40'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Exam Cards */}
      {exams.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📝</p>
          <p className="text-muted text-sm">No exams found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {exams.map((exam) => {
            const cfg = STATUS_CONFIG[exam.status];
            const canStart = exam.status === 'available';
            return (
              <div key={exam.id} className="bg-navy-card border border-border rounded-[20px] p-5 flex flex-col gap-4">
                {/* Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-muted bg-navy border border-border px-2 py-0.5 rounded-full font-mono">
                      {exam.classCode}
                    </span>
                    <h3 className="font-syne font-bold text-white-soft text-base mt-2">{exam.examName}</h3>
                    <p className="text-xs text-muted mt-0.5 truncate">{exam.className}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${cfg.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
                    <FiCalendar className="text-cyan shrink-0" />
                    <span>{fmtDT(exam.startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
                    <FiClock className="text-cyan shrink-0" />
                    <span>{exam.durationMinutes} min · {exam.questionCount} questions</span>
                  </div>
                </div>

                {/* Action */}
                <button
                  onClick={() => canStart && handleStart(exam)}
                  disabled={!canStart}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                    canStart
                      ? 'bg-blue text-white border-blue hover:bg-blue/80'
                      : exam.status === 'completed'
                        ? 'bg-transparent text-muted border-border cursor-not-allowed'
                        : 'bg-transparent text-gold border-gold/30 cursor-not-allowed'
                  }`}
                >
                  {canStart ? '🚀 Start Exam' : exam.status === 'completed' ? '✅ Completed' : '⏳ Not Started Yet'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
