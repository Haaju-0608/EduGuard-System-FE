import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCalendar, FiClock } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';

const UPCOMING = [
  { id: 'exam-002', examName: 'Quiz 1', classCode: 'DS201', startTime: '2026-06-28T13:00:00.000Z', durationMinutes: 45, status: 'upcoming' as const },
];
const AVAILABLE = [
  { id: 'exam-001', examName: 'Midterm Exam', classCode: 'OP212', startTime: '2026-06-27T08:00:00.000Z', durationMinutes: 90, status: 'available' as const },
];

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function StudentOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-br from-blue/20 to-navy-card border border-blue/20 rounded-[20px] p-6">
        <p className="text-blue-bright font-semibold text-sm">{greeting} 👋</p>
        <h1 className="font-syne text-2xl font-extrabold text-white-soft mt-1">{user?.name ?? 'Student'}</h1>
        <p className="text-muted text-sm mt-1">Here's what's happening with your exams today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Exams', value: 3, color: 'text-blue-bright', icon: '📝' },
          { label: 'Available', value: 1, color: 'text-green', icon: '🚀' },
          { label: 'Upcoming', value: 1, color: 'text-gold', icon: '⏳' },
          { label: 'Completed', value: 1, color: 'text-muted', icon: '✅' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg">{k.icon}</span>
            </div>
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Available exams (urgent) */}
      {AVAILABLE.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
              Available Now
            </h2>
            <button onClick={() => navigate('/student/exams')} className="text-xs text-blue-bright flex items-center gap-1 cursor-pointer bg-transparent border-none hover:underline">
              View all <FiArrowRight className="text-xs" />
            </button>
          </div>
          {AVAILABLE.map((exam) => (
            <div key={exam.id} className="bg-navy-card border border-green/20 rounded-[20px] p-5 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-muted font-mono bg-navy border border-border px-2 py-0.5 rounded-full">{exam.classCode}</span>
                <h3 className="font-syne font-bold text-white-soft text-base mt-2">{exam.examName}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
                  <span className="flex items-center gap-1"><FiCalendar className="text-cyan" />{fmtDT(exam.startTime)}</span>
                  <span className="flex items-center gap-1"><FiClock className="text-cyan" />{exam.durationMinutes} min</span>
                </div>
              </div>
              <button
                onClick={() => { localStorage.setItem(`studentExam_${exam.id}`, JSON.stringify(exam)); navigate(`/student/exams/${exam.id}/verify`); }}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green text-white text-sm font-semibold cursor-pointer hover:bg-green/80 transition-colors border-none whitespace-nowrap"
              >
                Start <FiArrowRight />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming exams */}
      {UPCOMING.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-syne font-bold text-white-soft text-base">Upcoming Exams</h2>
          {UPCOMING.map((exam) => (
            <div key={exam.id} className="bg-navy-card border border-border rounded-[20px] p-5 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-muted font-mono bg-navy border border-border px-2 py-0.5 rounded-full">{exam.classCode}</span>
                <h3 className="font-syne font-bold text-white-soft text-base mt-2">{exam.examName}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
                  <span className="flex items-center gap-1"><FiCalendar className="text-cyan" />{fmtDT(exam.startTime)}</span>
                  <span className="flex items-center gap-1"><FiClock className="text-cyan" />{exam.durationMinutes} min</span>
                </div>
              </div>
              <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Upcoming
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
