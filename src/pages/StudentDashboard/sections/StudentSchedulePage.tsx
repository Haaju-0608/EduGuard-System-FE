import { useState } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiLoader } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchStudentExamSlots } from '../../../services/schoolAdminApi';
import type { ExamSlot } from '../../../types/lecturer';

// ─── Helpers ──────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
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
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function fmtDateShort(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtFullDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

type DisplayStatus = 'upcoming' | 'available' | 'completed' | 'cancelled';

function deriveStatus(slot: ExamSlot): DisplayStatus {
  const now = Date.now();
  const start = new Date(slot.startTime).getTime();
  const end = new Date(slot.endTime).getTime();
  if (slot.status === 'completed') return 'completed';
  if (slot.status === 'cancelled') return 'cancelled';
  if (slot.status === 'ongoing' || (now >= start && now <= end)) return 'available';
  if (now < start) return 'upcoming';
  return 'completed';
}

const STATUS_STYLE: Record<DisplayStatus, { card: string; badge: string; dot: string; label: string }> = {
  upcoming:  { card: 'bg-blue/10 border-blue/25 text-blue-bright',   badge: 'bg-blue/20 text-blue-bright',   dot: 'bg-blue',           label: 'Upcoming' },
  available: { card: 'bg-green/10 border-green/25 text-green',       badge: 'bg-green/20 text-green',         dot: 'bg-green animate-pulse', label: 'Available' },
  completed: { card: 'bg-border/40 border-border text-muted',        badge: 'bg-white/5 text-muted',          dot: 'bg-muted',          label: 'Completed' },
  cancelled: { card: 'bg-red/10 border-red/25 text-red',             badge: 'bg-red/10 text-red',             dot: 'bg-red',            label: 'Cancelled' },
};

// ─── Exam Card ─────────────────────────────────────────────────────────────

function ExamCard({ slot, compact = false }: { slot: ExamSlot; compact?: boolean }) {
  const status = deriveStatus(slot);
  const style = STATUS_STYLE[status];

  return (
    <div className={`rounded-xl border p-2.5 space-y-1.5 ${style.card}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="font-syne font-bold text-[12px] leading-tight truncate">{compact ? slot.examName : slot.examName}</p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1 ${style.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
          {style.label}
        </span>
      </div>
      <p className="text-[10px] opacity-70 font-medium truncate">{slot.classCode} · {slot.className}</p>
      <div className="flex items-center gap-1 text-[10px] opacity-80">
        <FiClock className="text-[9px] shrink-0" />
        {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
        <span className="ml-1 opacity-60">({slot.durationMinutes}m)</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentSchedulePage() {
  const { user } = useAuth();
  const today = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const [view, setView] = useState<'week' | 'list'>('week');

  const { data, loading } = useAsyncData(
    () => fetchStudentExamSlots(user?.id ?? ''),
    [user?.id],
  );
  const exams: ExamSlot[] = data ?? [];

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday  = () => setWeekStart(getMonday(today));

  const isCurrentWeek = isSameDay(weekStart, getMonday(today));

  const todayExams = exams.filter((e) => isSameDay(new Date(e.startTime), today));
  const upcomingCount = exams.filter((e) => deriveStatus(e) === 'upcoming' || deriveStatus(e) === 'available').length;
  const sortedExams = [...exams].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="flex flex-col flex-1 gap-3 min-h-0">
      {/* ── Header + Toolbar (compact, shrink-0) ── */}
      <div className="shrink-0 bg-navy-card border border-border rounded-[20px] px-5 py-3 flex items-center gap-4 flex-wrap">
        {/* Title */}
        <div className="min-w-0">
          <h1 className="font-syne text-lg font-extrabold text-white-soft leading-tight">Exam Schedule</h1>
          <p className="text-muted text-xs">Your upcoming and past exam timetable.</p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {upcomingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-blue/10 border border-blue/20 rounded-lg px-3 py-1">
              <FiCalendar className="text-blue-bright text-xs shrink-0" />
              <span className="text-xs text-blue-bright font-semibold">{upcomingCount} upcoming</span>
            </div>
          )}
          {todayExams.length > 0 && (
            <div className="flex items-center gap-1.5 bg-green/10 border border-green/20 rounded-lg px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse shrink-0" />
              <span className="text-xs text-green font-semibold">{todayExams.length} today</span>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Week nav */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={prevWeek} className="w-8 h-8 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent">
            <FiChevronLeft className="text-sm" />
          </button>
          <div className="text-center min-w-36">
            <p className="text-xs font-semibold text-white-soft">{fmtMonth(weekStart)}</p>
            <p className="text-[10px] text-muted">{fmtDateShort(weekStart)} – {fmtDateShort(addDays(weekStart, 6))}</p>
          </div>
          <button onClick={nextWeek} className="w-8 h-8 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent">
            <FiChevronRight className="text-sm" />
          </button>
        </div>

        {/* Today + View toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {!isCurrentWeek && (
            <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-blue-bright/30 text-blue-bright text-xs font-bold cursor-pointer hover:bg-blue/10 transition-colors bg-transparent">
              Today
            </button>
          )}
          <div className="flex bg-navy border border-border rounded-lg p-0.5">
            {(['week', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-all ${
                  view === v ? 'bg-blue text-white' : 'text-muted hover:text-white-soft bg-transparent border-none'
                }`}
              >
                {v === 'week' ? '🗓 Week' : '📋 List'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 bg-navy-card border border-border rounded-[20px] flex flex-col items-center justify-center gap-3">
          <FiLoader className="text-2xl text-muted animate-spin" />
          <p className="text-muted text-sm">Loading exam schedule…</p>
        </div>
      )}

      {/* ── Week View ── */}
      {!loading && view === 'week' && (
        <div className="flex-1 bg-navy-card border border-border rounded-[20px] overflow-hidden flex flex-col">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border shrink-0">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div key={i} className={`px-2 py-2.5 text-center border-r last:border-r-0 border-border ${isToday ? 'bg-blue/10' : ''}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-blue-bright' : 'text-muted'}`}>
                    {DAY_SHORT[i]}
                  </p>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto mt-1 text-xs font-bold ${
                    isToday ? 'bg-blue text-white' : 'text-white-soft'
                  }`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Exam grid — flex-1 to fill remaining space */}
          <div className="grid grid-cols-7 flex-1">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              const dayExams = exams
                .filter((e) => isSameDay(new Date(e.startTime), day))
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
              return (
                <div key={i} className={`border-r last:border-r-0 border-border p-1.5 space-y-1.5 overflow-y-auto custom-scrollbar ${isToday ? 'bg-blue/5' : ''}`}>
                  {dayExams.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-[10px] text-muted">–</span>
                    </div>
                  ) : (
                    dayExams.map((e) => <ExamCard key={e.id} slot={e} compact />)
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend inside week view footer */}
          <div className="shrink-0 border-t border-border px-4 py-2 flex items-center gap-4 flex-wrap">
            {(Object.entries(STATUS_STYLE) as [DisplayStatus, typeof STATUS_STYLE[DisplayStatus]][]).map(([key, s]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                <span className="text-[10px] text-muted font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── List View ── */}
      {!loading && view === 'list' && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
          {sortedExams.length === 0 ? (
            <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
              <p className="text-muted text-sm">No exams found.</p>
            </div>
          ) : (
            sortedExams.map((slot) => {
              const status = deriveStatus(slot);
              const style = STATUS_STYLE[status];
              return (
                <div key={slot.id} className={`bg-navy-card border rounded-2xl overflow-hidden ${status === 'available' ? 'border-green/30' : status === 'upcoming' ? 'border-blue/30' : 'border-border'}`}>
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    {/* Date block */}
                    <div className="shrink-0 text-center w-10">
                      <p className="text-[9px] font-bold text-muted uppercase">
                        {new Date(slot.startTime).toLocaleDateString('en-GB', { month: 'short' })}
                      </p>
                      <p className="font-syne font-extrabold text-xl text-white-soft leading-none">
                        {new Date(slot.startTime).getDate()}
                      </p>
                      <p className="text-[9px] text-muted">
                        {new Date(slot.startTime).toLocaleDateString('en-GB', { weekday: 'short' })}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-10 shrink-0 bg-border" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-syne font-bold text-white-soft text-sm truncate">{slot.examName}</p>
                          <p className="text-xs text-muted mt-0.5">{slot.classCode} · {slot.className}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${style.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted">
                        <span className="flex items-center gap-1">
                          <FiClock className="text-[10px]" />
                          {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
                        </span>
                        <span className="opacity-60">{slot.durationMinutes} min</span>
                        <span className="opacity-60 hidden sm:block">{fmtFullDate(slot.startTime)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
