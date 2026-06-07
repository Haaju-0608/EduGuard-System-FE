import React from 'react';
import { FiFileText, FiClock, FiMapPin, FiShield, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

interface ExamItem {
  id: string;
  code: string;
  name: string;
  date: string;
  time: string;
  room: string;
  seatNumber: string;
  proctorMethod: string;
  status: 'upcoming' | 'completed' | 'absent';
  proctorStatus: 'verified' | 'unverified' | 'normal' | '—';
}

const examList: ExamItem[] = [
  {
    id: 'e1',
    code: 'CS101',
    name: 'Database Systems Midterm',
    date: '2026-06-10',
    time: '09:00 - 11:00',
    room: 'Hall A',
    seatNumber: 'A-24',
    proctorMethod: 'AI Face & Gaze Tracking',
    status: 'upcoming',
    proctorStatus: 'normal',
  },
  {
    id: 'e2',
    code: 'CS201',
    name: 'Web Programming Final',
    date: '2026-06-15',
    time: '07:30 - 09:30',
    room: 'A2-301',
    seatNumber: 'B-12',
    proctorMethod: 'AI Face & Gaze Tracking',
    status: 'upcoming',
    proctorStatus: 'normal',
  },
  {
    id: 'e3',
    code: 'MATH101',
    name: 'Math Analysis Final',
    date: '2026-06-02',
    time: '13:30 - 15:30',
    room: 'Hall A',
    seatNumber: 'A-05',
    proctorMethod: 'AI Face Verification',
    status: 'completed',
    proctorStatus: 'verified',
  },
];

export default function ExamsPage() {
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
            <FiFileText />
          </div>
          <div>
            <h1 className="font-syne text-2xl font-extrabold text-white-soft">Exam Registry</h1>
            <p className="text-muted text-sm mt-0.5">View your upcoming scheduled exams, seat arrangements, and AI-monitored proctoring details.</p>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        
        {/* Left Column: Exam List */}
        <div className="space-y-4">
          <h2 className="font-syne font-bold text-lg text-white-soft mb-2 border-b border-border pb-3">Registered Exams</h2>
          {examList.map((exam, i) => (
            <div
              key={exam.id}
              className="bg-navy-card border border-border rounded-[24px] p-6 space-y-4 hover:border-cyan/35 transition-all duration-300 animate-fade-slide-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-cyan bg-cyan/10 px-2.5 py-1 rounded">
                    {exam.code}
                  </span>
                  <h3 className="font-syne font-extrabold text-base text-white-soft">{exam.name}</h3>
                </div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full border w-fit ${
                  exam.status === 'upcoming' ? 'text-gold bg-gold/10 border-gold/20' :
                  exam.status === 'completed' ? 'text-green bg-green/10 border-green/20' :
                  'text-red bg-red/10 border-red/20'
                }`}>
                  {exam.status === 'upcoming' ? 'Upcoming' : 'Completed'}
                </span>
              </div>

              {/* Detail specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-navy/40 border border-border/40 rounded-xl p-4 text-xs font-dm text-muted">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Date & Time</p>
                  <p className="text-white-soft font-semibold flex items-center gap-1.5 font-mono">
                    <FiClock className="text-cyan text-xs shrink-0" /> {exam.date}
                  </p>
                  <p className="text-[10px] text-muted font-mono mt-0.5">{exam.time}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Location / Room</p>
                  <p className="text-white-soft font-semibold flex items-center gap-1.5">
                    <FiMapPin className="text-cyan text-xs shrink-0" /> Room {exam.room}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Seat Number</p>
                  <p className="text-cyan font-mono font-extrabold text-sm">{exam.seatNumber}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Proctor Status</p>
                  <p className={`font-semibold flex items-center gap-1.5 ${
                    exam.proctorStatus === 'verified' || exam.proctorStatus === 'normal' ? 'text-green font-semibold' : 'text-muted'
                  }`}>
                    <FiShield className="shrink-0" /> 
                    {exam.proctorStatus === 'verified' ? 'Face Verified' : exam.proctorStatus === 'normal' ? 'Secure' : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted font-dm">
                <span>🛡️ AI Proctoring Mode:</span>
                <span className="text-cyan font-bold bg-cyan/5 border border-cyan/15 px-2 py-0.5 rounded">{exam.proctorMethod}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Proctoring Guidelines */}
        <div className="bg-navy-card border border-border rounded-[24px] p-6 space-y-4 h-fit">
          <h2 className="font-syne font-bold text-lg text-white-soft flex items-center gap-2 border-b border-border pb-3 mb-2">
            <FiShield className="text-gold" />
            AI Proctoring Rules
          </h2>
          <div className="space-y-4 text-xs text-muted leading-relaxed font-dm">
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-cyan/10 text-cyan flex items-center justify-center shrink-0 font-bold font-mono">1</span>
              <p>Your **official student face registration** must be completed and approved before joining an exam room.</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-cyan/10 text-cyan flex items-center justify-center shrink-0 font-bold font-mono">2</span>
              <p>During proctored sessions, maintain eye contact with the screen. Continuous gaze deflection &gt;5s triggers system flags.</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-cyan/10 text-cyan flex items-center justify-center shrink-0 font-bold font-mono">3</span>
              <p>Keep your camera frame clear of secondary faces. Dual-face detection is marked as a critical exam violation.</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-cyan/10 text-cyan flex items-center justify-center shrink-0 font-bold font-mono">4</span>
              <p>In case of temporary technical errors or gaze miscalibrations, report immediately to the exam supervisor.</p>
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex gap-3 text-xs text-yellow-600 font-dm">
            <FiAlertTriangle className="text-xl shrink-0 mt-0.5" />
            <p><strong>Note:</strong> Attempting to bypass AI face filters or webcam access will lead to immediate exam disqualification.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
