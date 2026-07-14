import React, { useState } from 'react';
import { FiClock, FiUser, FiMapPin, FiCalendar, FiCheckCircle, FiBookOpen } from 'react-icons/fi';

interface ScheduleClass {
  id: string;
  code: string;
  name: string;
  time: string;
  duration: string;
  room: string;
  instructor: string;
  facultyId: 'it' | 'economics' | 'business' | 'engineering' | 'foreign-lang';
  status: 'present' | 'absent' | 'late' | 'excused' | 'upcoming';
  statusText: string;
}

const facultyConfig = {
  it: { colorClass: 'text-blue-bright', borderClass: 'border-l-blue-bright', bgClass: 'bg-blue/5', badgeBg: 'bg-blue/10' },
  economics: { colorClass: 'text-gold', borderClass: 'border-l-gold', bgClass: 'bg-gold/5', badgeBg: 'bg-gold/10' },
  business: { colorClass: 'text-green', borderClass: 'border-l-green', bgClass: 'bg-green/5', badgeBg: 'bg-green/10' },
  engineering: { colorClass: 'text-purple-500', borderClass: 'border-l-purple-500', bgClass: 'bg-purple-500/5', badgeBg: 'bg-purple-500/10' },
  'foreign-lang': { colorClass: 'text-cyan', borderClass: 'border-l-cyan', bgClass: 'bg-cyan/5', badgeBg: 'bg-cyan/10' },
};

const weeklySchedules: Record<string, ScheduleClass[]> = {
  Monday: [
    { id: 'm1', code: 'CS201', name: 'Web Programming', time: '07:30 - 09:30', duration: '120 min', room: 'A2-301', instructor: 'Dr. Nguyen Van An', facultyId: 'it', status: 'present', statusText: '✓ Present' },
    { id: 'm2', code: 'CS101', name: 'Database Systems', time: '09:45 - 11:45', duration: '120 min', room: 'B1-205', instructor: 'Prof. Le Van Binh', facultyId: 'economics', status: 'present', statusText: '✓ Present' },
  ],
  Tuesday: [
    { id: 't1', code: 'MATH101', name: 'Math Analysis', time: '13:30 - 15:30', duration: '120 min', room: 'Hall A', instructor: 'Dr. Pham Thi Cuc', facultyId: 'engineering', status: 'present', statusText: '✓ Present' },
  ],
  Wednesday: [
    { id: 'w1', code: 'CS201', name: 'Web Programming', time: '07:30 - 09:30', duration: '120 min', room: 'A2-301', instructor: 'Dr. Nguyen Van An', facultyId: 'it', status: 'present', statusText: '✓ Present' },
    { id: 'w2', code: 'CS101', name: 'Database Systems', time: '09:45 - 11:45', duration: '120 min', room: 'B1-205', instructor: 'Prof. Le Van Binh', facultyId: 'economics', status: 'upcoming', statusText: 'Upcoming' },
    { id: 'w3', code: 'CS302', name: 'Software Engineering', time: '13:30 - 15:30', duration: '120 min', room: 'C3-102', instructor: 'Dr. Tran Van Dung', facultyId: 'it', status: 'upcoming', statusText: 'Upcoming' },
  ],
  Thursday: [
    { id: 'h1', code: 'ENG201', name: 'English Communication', time: '15:00 - 17:00', duration: '120 min', room: 'C3-102', instructor: 'Ms. Emily Smith', facultyId: 'foreign-lang', status: 'upcoming', statusText: 'Upcoming' },
  ],
  Friday: [
    { id: 'f1', code: 'CS302', name: 'Software Engineering', time: '15:00 - 17:00', duration: '120 min', room: 'C3-102', instructor: 'Dr. Tran Van Dung', facultyId: 'it', status: 'upcoming', statusText: 'Upcoming' },
  ],
  Saturday: [],
};

export default function SchedulePage() {
  const [selectedDay, setSelectedDay] = useState('Wednesday');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const classes = weeklySchedules[selectedDay] || [];

  return (
    <div className="space-y-6">
      
      {/* ── Page Banner (Glow Mesh style) ── */}
      <div className="uni-page-banner rounded-[24px] p-6 relative overflow-hidden group">
        <div className="uni-banner-grid absolute inset-0 z-0 opacity-40" />
        
        {/* Glow Orb */}
        <div
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[60px] opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity duration-700"
          style={{ background: 'radial-gradient(circle, var(--color-blue) 0%, transparent 70%)' }}
        />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue to-cyan text-white flex items-center justify-center text-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)]">
            <FiCalendar />
          </div>
          <div>
            <h1 className="font-syne text-2xl font-extrabold text-white-soft">Class Schedule</h1>
            <p className="text-muted text-sm mt-0.5">View your weekly academic lecture schedule, instructor assignments, and proctored class locations.</p>
          </div>
        </div>
      </div>

      {/* ── Weekly Tab Selector (Unified glass bar) ── */}
      <div className="bg-navy-card/80 backdrop-blur-[8px] border border-border/80 rounded-[20px] p-1.5 flex gap-1 overflow-x-auto custom-scrollbar shadow-xs">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`flex-1 min-w-[100px] text-center py-2.5 rounded-[14px] font-syne font-bold text-xs cursor-pointer transition-all duration-200 border-0 ${
              selectedDay === day
                ? 'bg-linear-to-br from-blue to-cyan text-white shadow-[0_4px_14px_rgba(79,70,229,0.2)]'
                : 'bg-transparent text-muted hover:text-white-soft hover:bg-white-soft/5'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* ── Schedule Timeline ── */}
      <div className="bg-navy-card border border-border rounded-[24px] p-6">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
          <h2 className="font-syne font-bold text-lg text-white-soft">Lectures for {selectedDay}</h2>
          <span className="text-xs text-muted font-dm bg-navy px-3 py-1 rounded-full border border-border">
            {classes.length} {classes.length === 1 ? 'class' : 'classes'}
          </span>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-16 text-muted space-y-3">
            <div className="w-16 h-16 rounded-full bg-navy/60 border border-border flex items-center justify-center text-3xl mx-auto">☕</div>
            <h3 className="font-syne font-bold text-base text-white-soft pt-1">No classes scheduled</h3>
            <p className="text-xs text-muted max-w-[280px] mx-auto leading-relaxed">Enjoy your day off! Take this time to review previous course work or assignments.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {classes.map((cls, i) => {
              const fac = facultyConfig[cls.facultyId] || facultyConfig.it;
              return (
                <div
                  key={cls.id}
                  className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6 relative animate-fade-slide-in"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  
                  {/* Left Column: Time & Duration */}
                  <div className="flex md:flex-col items-center md:items-end md:text-right min-w-[110px] shrink-0 pt-1">
                    <span className="text-sm font-mono font-bold text-white-soft flex items-center gap-1.5 md:flex-row-reverse">
                      <FiClock className="text-cyan text-xs shrink-0 md:hidden" />
                      {cls.time.split(' - ')[0]}
                    </span>
                    <span className="text-[10px] text-muted font-mono font-medium md:mt-0.5 ml-2 md:ml-0 bg-navy/80 px-2 py-0.5 rounded md:bg-transparent md:p-0">
                      {cls.time.split(' - ')[1]}
                    </span>
                    <span className="hidden md:inline text-[9px] text-cyan font-bold uppercase tracking-wider mt-1">{cls.duration}</span>
                  </div>

                  {/* Middle Column: Vertical Axis Node */}
                  <div className="hidden md:flex flex-col items-center self-stretch relative">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 border-navy-card z-10 mt-1.5 shrink-0 ${
                      cls.status === 'present' ? 'bg-green shadow-[0_0_8px_var(--color-green)]' :
                      cls.status === 'upcoming' ? 'bg-gold shadow-[0_0_8px_var(--color-gold)]' :
                      'bg-muted'
                    }`} />
                    {i < classes.length - 1 && (
                      <div className="w-px bg-border absolute top-5 bottom-0 left-[6.5px] -z-0" />
                    )}
                  </div>

                  {/* Right Column: Premium Course Card */}
                  <div className={`flex-1 bg-navy border ${fac.borderClass} border-l-[4px] rounded-[18px] p-5 transition-all duration-300 hover:border-cyan/35 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(99,102,241,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                    
                    {/* Course Title & Room info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono font-extrabold ${fac.colorClass} ${fac.badgeBg} px-2 py-0.5 rounded`}>
                          {cls.code}
                        </span>
                        <h3 className="font-syne font-extrabold text-base text-white-soft">
                          {cls.name}
                        </h3>
                      </div>

                      {/* Specs */}
                      <div className="flex items-center gap-4 text-xs text-muted font-dm flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <FiMapPin className="text-cyan text-sm shrink-0" />
                          <span className="font-semibold text-white-soft">Room {cls.room}</span>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-border" />
                        <div className="flex items-center gap-1.5">
                          <FiUser className="text-cyan text-sm shrink-0" />
                          <span>{cls.instructor}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="sm:text-right shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full border ${
                        cls.status === 'present' ? 'text-green bg-green/10 border-green/20' :
                        cls.status === 'upcoming' ? 'text-gold bg-gold/10 border-gold/20' :
                        'text-muted bg-white-soft/5 border-border'
                      }`}>
                        {cls.status === 'present' && <span className="w-1.5 h-1.5 rounded-full bg-green" />}
                        {cls.status === 'upcoming' && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
                        {cls.statusText}
                      </span>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
