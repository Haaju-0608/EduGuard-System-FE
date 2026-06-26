import React, { useState } from 'react';
import { FiBookOpen, FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiUser } from 'react-icons/fi';

// ─── Mock data ────────────────────────────────────────────────────────────

interface ClassSession {
  id: string;
  className: string;
  classCode: string;
  lecturer: string;
  room: string;
  dayOfWeek: number; // 0=Mon … 6=Sun
  startTime: string; // 'HH:mm'
  endTime: string;
  color: string; // tailwind bg color token
}

const SESSIONS: ClassSession[] = [
  { id: '1', className: 'Object Oriented Programming', classCode: 'OP212', lecturer: 'Dr. Nguyen Van A', room: 'B201',  dayOfWeek: 0, startTime: '07:30', endTime: '09:00', color: 'bg-blue/20 border-blue/30 text-blue-bright' },
  { id: '2', className: 'Data Structures',             classCode: 'DS201', lecturer: 'Dr. Tran Thi B',   room: 'A105',  dayOfWeek: 1, startTime: '09:15', endTime: '10:45', color: 'bg-purple/20 border-purple/30 text-purple-300' },
  { id: '3', className: 'Database Systems',            classCode: 'DB301', lecturer: 'Dr. Le Van C',    room: 'C301',  dayOfWeek: 2, startTime: '13:00', endTime: '14:30', color: 'bg-green/20 border-green/30 text-green' },
  { id: '4', className: 'Software Engineering',        classCode: 'SE401', lecturer: 'Dr. Pham Thi D',  room: 'D402',  dayOfWeek: 3, startTime: '07:30', endTime: '09:00', color: 'bg-gold/20 border-gold/30 text-gold' },
  { id: '5', className: 'Object Oriented Programming', classCode: 'OP212', lecturer: 'Dr. Nguyen Van A', room: 'B201',  dayOfWeek: 3, startTime: '13:00', endTime: '14:30', color: 'bg-blue/20 border-blue/30 text-blue-bright' },
  { id: '6', className: 'Data Structures',             classCode: 'DS201', lecturer: 'Dr. Tran Thi B',   room: 'A105',  dayOfWeek: 4, startTime: '09:15', endTime: '10:45', color: 'bg-purple/20 border-purple/30 text-purple-300' },
  { id: '7', className: 'Database Systems',            classCode: 'DB301', lecturer: 'Dr. Le Van C',    room: 'C301',  dayOfWeek: 0, startTime: '15:00', endTime: '16:30', color: 'bg-green/20 border-green/30 text-green' },
  { id: '8', className: 'Software Engineering',        classCode: 'SE401', lecturer: 'Dr. Pham Thi D',  room: 'D402',  dayOfWeek: 2, startTime: '07:30', endTime: '09:00', color: 'bg-gold/20 border-gold/30 text-gold' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// ─── Helpers ──────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDateShort(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// ─── Session Card ──────────────────────────────────────────────────────────

function SessionCard({ session, compact = false }: { session: ClassSession; compact?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 space-y-1.5 ${session.color}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="font-syne font-bold text-[13px] leading-tight">{compact ? session.classCode : session.className}</p>
        <span className="text-[10px] font-bold font-mono opacity-70 shrink-0">{session.classCode}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] opacity-80">
        <span className="flex items-center gap-1"><FiClock className="text-[10px]" />{session.startTime}–{session.endTime}</span>
        <span className="flex items-center gap-1"><FiMapPin className="text-[10px]" />{session.room}</span>
        {!compact && <span className="flex items-center gap-1"><FiUser className="text-[10px]" />{session.lecturer}</span>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentSchedulePage() {
  const today = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const [view, setView] = useState<'week' | 'list'>('week');

  const weekDays = DAY_NAMES.map((_, i) => addDays(weekStart, i));

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday  = () => setWeekStart(getMonday(today));

  const isCurrentWeek = isSameDay(weekStart, getMonday(today));

  // Today's sessions (for list hint)
  const todaySessions = SESSIONS.filter((s) => s.dayOfWeek === (today.getDay() === 0 ? 6 : today.getDay() - 1));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Schedule</h1>
          <p className="text-muted text-sm mt-1">Your weekly class timetable.</p>
        </div>
        {/* Today classes quick info */}
        {todaySessions.length > 0 && (
          <div className="flex items-center gap-2 bg-blue/10 border border-blue/20 rounded-xl px-4 py-2">
            <FiBookOpen className="text-blue-bright shrink-0" />
            <span className="text-sm text-blue-bright font-semibold">{todaySessions.length} class{todaySessions.length > 1 ? 'es' : ''} today</span>
          </div>
        )}
      </div>

      {/* Calendar toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Week nav */}
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-9 h-9 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent">
            <FiChevronLeft />
          </button>
          <div className="text-center min-w-[160px]">
            <p className="text-sm font-semibold text-white-soft">{fmtMonth(weekStart)}</p>
            <p className="text-xs text-muted">{fmtDateShort(weekStart)} – {fmtDateShort(addDays(weekStart, 4))}</p>
          </div>
          <button onClick={nextWeek} className="w-9 h-9 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent">
            <FiChevronRight />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button onClick={goToday} className="px-3 py-2 rounded-xl border border-blue-bright/30 text-blue-bright text-xs font-bold cursor-pointer hover:bg-blue/10 transition-colors bg-transparent">
              Today
            </button>
          )}
          {/* View toggle */}
          <div className="flex bg-navy-card border border-border rounded-xl p-0.5">
            {(['week', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all capitalize ${
                  view === v ? 'bg-blue text-white' : 'text-muted hover:text-white-soft bg-transparent border-none'
                }`}
              >
                {v === 'week' ? '🗓 Week' : '📋 List'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Week View ── */}
      {view === 'week' && (
        <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-5 border-b border-border">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div key={i} className={`px-3 py-3 text-center border-r last:border-r-0 border-border ${isToday ? 'bg-blue/10' : ''}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-bright' : 'text-muted'}`}>
                    {DAY_SHORT[i]}
                  </p>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto mt-1 text-sm font-bold ${
                    isToday ? 'bg-blue text-white' : 'text-white-soft'
                  }`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Session grid */}
          <div className="grid grid-cols-5 min-h-[360px]">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              const daySessions = SESSIONS.filter((s) => s.dayOfWeek === i).sort((a, b) => a.startTime.localeCompare(b.startTime));
              return (
                <div key={i} className={`border-r last:border-r-0 border-border p-2 space-y-2 ${isToday ? 'bg-blue/5' : ''}`}>
                  {daySessions.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-[11px] text-muted">–</span>
                    </div>
                  ) : (
                    daySessions.map((s) => <SessionCard key={s.id} session={s} compact />)
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── List View ── */}
      {view === 'list' && (
        <div className="space-y-4">
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            const daySessions = SESSIONS.filter((s) => s.dayOfWeek === i).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <div key={i} className={`bg-navy-card border rounded-[20px] overflow-hidden ${isToday ? 'border-blue/30' : 'border-border'}`}>
                {/* Day header */}
                <div className={`flex items-center gap-3 px-5 py-3 border-b ${isToday ? 'border-blue/20 bg-blue/10' : 'border-border bg-navy/40'}`}>
                  <div className={`w-8 h-8 rounded-lg font-bold text-sm grid place-items-center shrink-0 ${isToday ? 'bg-blue text-white' : 'bg-navy border border-border text-muted'}`}>
                    {day.getDate()}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${isToday ? 'text-blue-bright' : 'text-white-soft'}`}>
                      {DAY_NAMES[i]} {isToday && <span className="text-xs ml-1 font-normal opacity-70">(Today)</span>}
                    </p>
                    <p className="text-xs text-muted">{fmtDateShort(day)}</p>
                  </div>
                  <span className="ml-auto text-xs text-muted">{daySessions.length} class{daySessions.length !== 1 ? 'es' : ''}</span>
                </div>

                {/* Sessions */}
                {daySessions.length === 0 ? (
                  <div className="py-6 text-center text-muted text-sm">No classes</div>
                ) : (
                  <div className="p-4 space-y-3">
                    {daySessions.map((s) => <SessionCard key={s.id} session={s} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="bg-navy-card border border-border rounded-2xl p-4">
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Subjects</p>
        <div className="flex flex-wrap gap-3">
          {[...new Map(SESSIONS.map((s) => [s.classCode, s])).values()].map((s) => (
            <div key={s.classCode} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border ${s.color}`}>
              <span className="font-bold">{s.classCode}</span>
              <span className="opacity-70 hidden sm:block">— {s.className}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
