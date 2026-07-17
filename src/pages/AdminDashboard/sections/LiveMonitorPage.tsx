import React, { useState, useEffect } from 'react';
import { FiTv, FiAlertTriangle, FiCheckCircle, FiActivity, FiVolume2, FiVolumeX, FiGrid, FiList } from 'react-icons/fi';

interface StudentStream {
  id: string;
  name: string;
  matchScore: number;
  status: 'Normal' | 'Warning' | 'Critical';
  avatarColor: string;
}

interface RoomRecord {
  id: string;
  name: string;
  course: string;
  lecturer: string;
  activeCount: number;
  violationCount: number;
  status: 'Secure' | 'Violations';
  students: StudentStream[];
}

const initialRooms: RoomRecord[] = [
  {
    id: 'R-301',
    name: 'Room B2-301',
    course: 'IT002 - Web Development',
    lecturer: 'Dr. Le Minh',
    activeCount: 24,
    violationCount: 0,
    status: 'Secure',
    students: [
      { id: 'SV820491', name: 'Nguyen Van An', matchScore: 99.4, status: 'Normal', avatarColor: 'from-blue to-cyan' },
      { id: 'SV820492', name: 'Tran Thi Bao', matchScore: 98.1, status: 'Normal', avatarColor: 'from-indigo to-purple' },
      { id: 'SV820493', name: 'Pham Duc', matchScore: 95.7, status: 'Normal', avatarColor: 'from-pink to-rose' },
      { id: 'SV820495', name: 'Le Quang Minh', matchScore: 99.8, status: 'Normal', avatarColor: 'from-emerald to-teal' },
    ],
  },
  {
    id: 'R-102',
    name: 'Room A1-102',
    course: 'CS101 - Intro to CS',
    lecturer: 'Prof. Sarah Connor',
    activeCount: 18,
    violationCount: 2,
    status: 'Violations',
    students: [
      { id: 'SV820494', name: 'Bui Kim', matchScore: 71.3, status: 'Critical', avatarColor: 'from-amber to-orange' },
      { id: 'SV820496', name: 'Hoang Long', matchScore: 97.4, status: 'Normal', avatarColor: 'from-cyan to-blue' },
      { id: 'SV820497', name: 'Mai Huong', matchScore: 84.2, status: 'Warning', avatarColor: 'from-fuchsia to-purple' },
      { id: 'SV820498', name: 'Quoc Tuan', matchScore: 99.1, status: 'Normal', avatarColor: 'from-lime to-green' },
    ],
  },
  {
    id: 'R-204',
    name: 'Room C5-204',
    course: 'MATH301 - Linear Algebra',
    lecturer: 'Dr. Nguyen Van B',
    activeCount: 30,
    violationCount: 0,
    status: 'Secure',
    students: [
      { id: 'SV820501', name: 'Pham Minh', matchScore: 98.9, status: 'Normal', avatarColor: 'from-orange to-red' },
      { id: 'SV820502', name: 'Vu Lam', matchScore: 99.2, status: 'Normal', avatarColor: 'from-violet to-fuchsia' },
      { id: 'SV820503', name: 'Trinh Khanh', matchScore: 96.8, status: 'Normal', avatarColor: 'from-teal to-blue' },
      { id: 'SV820504', name: 'Doan Trang', matchScore: 98.5, status: 'Normal', avatarColor: 'from-green to-emerald' },
    ],
  },
];

interface LogEvent {
  id: string;
  time: string;
  room: string;
  student: string;
  violation: string;
  severity: 'Warning' | 'Critical';
}

const initialLogs: LogEvent[] = [
  { id: 'L1', time: '15:28:10', room: 'Room A1-102', student: 'Bui Kim', violation: 'Looking away from screen (5s)', severity: 'Critical' },
  { id: 'L2', time: '15:27:45', room: 'Room A1-102', student: 'Mai Huong', violation: 'Multiple faces in webcam', severity: 'Warning' },
  { id: 'L3', time: '15:24:12', room: 'Room B2-301', student: 'Pham Duc', violation: 'Low light warning', severity: 'Warning' },
];

export default function LiveMonitorPage() {
  const [rooms, setRooms] = useState<RoomRecord[]>(initialRooms);
  const [logs, setLogs] = useState<LogEvent[]>(initialLogs);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'Grid' | 'List'>('Grid');

  // Simulate real-time monitoring events
  useEffect(() => {
    const names = ['Nguyen Van An', 'Tran Thi Bao', 'Pham Duc', 'Bui Kim', 'Quoc Tuan', 'Pham Minh', 'Vu Lam', 'Mai Huong'];
    const violations = [
      'Looking away from screen',
      'Using mobile phone',
      'Leaving proctored seat',
      'Multiple people detected',
      'Tab switching detected',
    ];
    const roomNames = ['Room B2-301', 'Room A1-102', 'Room C5-204'];

    const interval = setInterval(() => {
      // 1. Create a random mock log
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomViolation = violations[Math.floor(Math.random() * violations.length)];
      const randomRoom = roomNames[Math.floor(Math.random() * roomNames.length)];
      const isCritical = Math.random() > 0.4;
      
      const now = new Date();
      const timeString = now.toTimeString().split(' ')[0];
      
      const newLog: LogEvent = {
        id: 'L-' + Math.random().toString(36).substr(2, 5),
        time: timeString,
        room: randomRoom,
        student: randomName,
        violation: randomViolation,
        severity: isCritical ? 'Critical' : 'Warning',
      };

      setLogs((prev) => [newLog, ...prev.slice(0, 19)]);

      // 2. Play sound indicator if enabled
      if (soundEnabled && isCritical) {
        // Simple mock audio alert using AudioContext
        try {
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, context.currentTime); // A5 note
          gain.gain.setValueAtTime(0.05, context.currentTime);
          osc.connect(gain);
          gain.connect(context.destination);
          osc.start();
          osc.stop(context.currentTime + 0.15);
        } catch (e) {
          // ignore blocked audio errors
        }
      }

      // 3. Update matching room stats & student statuses randomly
      setRooms((prevRooms) =>
        prevRooms.map((room) => {
          if (room.name === randomRoom) {
            const updatedStudents: StudentStream[] = room.students.map((student) => {
              if (student.name === randomName) {
                return {
                  ...student,
                  matchScore: Math.floor(65 + Math.random() * 30),
                  status: (isCritical ? 'Critical' : 'Warning') as 'Critical' | 'Warning' | 'Normal',
                };
              }
              // recover others slowly
              if (Math.random() > 0.7) {
                return {
                  ...student,
                  matchScore: Math.floor(95 + Math.random() * 5),
                  status: 'Normal',
                };
              }
              return student;
            });

            const criticalCount = updatedStudents.filter((s) => s.status === 'Critical').length;
            const warningCount = updatedStudents.filter((s) => s.status === 'Warning').length;

            return {
              ...room,
              students: updatedStudents,
              violationCount: criticalCount + warningCount,
              status: criticalCount + warningCount > 0 ? 'Violations' : 'Secure',
            };
          }
          return room;
        })
      );
    }, 6000); // Trigger simulation tick every 6s

    return () => clearInterval(interval);
  }, [soundEnabled]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-syne font-extrabold text-2xl text-white-soft flex items-center gap-2">
            <FiTv className="text-cyan animate-pulse" />
            Live Monitor Center
          </h1>
          <p className="text-muted font-dm text-sm mt-1">
            Real-time biometric analytics, exam room supervision feed, and AI violation logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl font-dm text-xs font-semibold cursor-pointer transition-colors ${
              soundEnabled
                ? 'border-cyan/50 text-cyan bg-cyan/10'
                : 'border-border/60 text-muted bg-navy/40 hover:text-white-soft'
            }`}
          >
            {soundEnabled ? <FiVolume2 className="text-sm" /> : <FiVolumeX className="text-sm" />}
            <span>{soundEnabled ? 'Alert Sound ON' : 'Alert Sound Muted'}</span>
          </button>

          {/* Tab Selector */}
          <div className="flex bg-navy border border-border rounded-xl p-1">
            <button
              onClick={() => setActiveTab('Grid')}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${activeTab === 'Grid' ? 'bg-navy-mid text-cyan' : 'text-muted hover:text-white-soft'}`}
            >
              <FiGrid className="text-sm" />
            </button>
            <button
              onClick={() => setActiveTab('List')}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${activeTab === 'List' ? 'bg-navy-mid text-cyan' : 'text-muted hover:text-white-soft'}`}
            >
              <FiList className="text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left is Rooms, Right is logs feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rooms Supervision Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <FiActivity className="text-blue-bright" />
              Active Exams ({rooms.length})
            </h2>
            <span className="text-xs text-muted font-dm">Simulated live webcam streams</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`bg-navy-card border rounded-2xl overflow-hidden p-4 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(6,182,212,0.06)] hover:border-cyan/30 flex flex-col justify-between ${
                  room.status === 'Violations' ? 'border-red/40 bg-linear-to-b from-navy-card to-red/3' : 'border-border'
                }`}
              >
                {/* Room title details */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-syne font-bold text-white-soft text-sm">{room.name}</h3>
                      <p className="text-[11px] text-muted font-dm truncate max-w-[200px]">{room.course}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        room.status === 'Violations'
                          ? 'bg-red/10 text-red border-red/25 animate-pulse'
                          : 'bg-green/10 text-green border-green/25'
                      }`}
                    >
                      {room.status === 'Violations' ? '⚠️ Violation Flags' : '🛡️ Secure'}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted font-dm mb-4">Instructor: {room.lecturer}</p>
                </div>

                {/* Simulated Webcam video feeds grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {room.students.map((student) => {
                    const isWarning = student.status === 'Warning';
                    const isCritical = student.status === 'Critical';
                    
                    return (
                      <div
                        key={student.id}
                        className={`relative rounded-xl aspect-[4/3] bg-navy overflow-hidden border grid place-items-center group ${
                          isCritical
                            ? 'border-red animate-pulse'
                            : isWarning
                            ? 'border-gold'
                            : 'border-border/60 group-hover:border-cyan/40'
                        }`}
                      >
                        {/* Overlay Face Recognition Bounding Box details */}
                        <div
                          className={`absolute inset-2 border-2 rounded-md transition-opacity pointer-events-none ${
                            isCritical ? 'border-red/60 animate-ping' : isWarning ? 'border-gold/60' : 'border-cyan/20 opacity-0 group-hover:opacity-100'
                          }`}
                        />

                        {/* Dummy stream placeholder avatar */}
                        <div className={`w-10 h-10 rounded-full bg-linear-to-br ${student.avatarColor} grid place-items-center text-white text-[10px] font-syne font-extrabold shadow-md opacity-80`}>
                          {student.name.split(' ').map((n) => n[0]).slice(-2).join('')}
                        </div>

                        {/* Top banner tag */}
                        <div className="absolute top-1 left-1.5 flex flex-col gap-0.5">
                          <span className="text-[8px] font-semibold text-white-soft truncate max-w-[75px] drop-shadow-md">
                            {student.name}
                          </span>
                        </div>

                        {/* Bottom Score badge */}
                        <div className="absolute bottom-1 right-1.5 flex items-center gap-0.5">
                          <span
                            className={`text-[8px] font-mono font-semibold px-1 rounded-sm ${
                              isCritical ? 'bg-red text-white' : isWarning ? 'bg-gold text-navy font-bold' : 'bg-black/60 text-cyan'
                            }`}
                          >
                            AI: {student.matchScore}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer details */}
                <div className="flex items-center justify-between border-t border-border/30 pt-3 text-[11px] font-dm text-muted">
                  <span>Students Active: {room.activeCount}</span>
                  <span className={room.violationCount > 0 ? 'text-red font-semibold' : ''}>
                    {room.violationCount > 0 ? `${room.violationCount} Violations` : '0 issues'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Warning Logs Sidepanel */}
        <div className="space-y-4">
          <h2 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
            <FiAlertTriangle className="text-gold" />
            Live Event Logger
          </h2>

          <div className="bg-navy-card border border-border rounded-2xl p-4 flex flex-col gap-3 h-[490px] overflow-y-auto custom-scrollbar">
            {logs.length > 0 ? (
              logs.map((log) => {
                const isCritical = log.severity === 'Critical';
                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border transition-all duration-300 ${
                      isCritical
                        ? 'border-red/30 bg-red/5 hover:bg-red/8'
                        : 'border-gold/30 bg-gold/5 hover:bg-gold/8'
                    } flex items-start gap-2.5 animate-fade-slide-in`}
                  >
                    <span className="mt-0.5">
                      {isCritical ? (
                        <span className="text-red">🔴</span>
                      ) : (
                        <span className="text-gold">🟡</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0 font-dm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[10px] text-muted">{log.time}</span>
                        <span className="text-[10px] text-muted bg-navy border border-border px-1.5 py-0.5 rounded-sm">
                          {log.room}
                        </span>
                      </div>
                      <p className="text-xs text-white-soft font-semibold truncate">{log.student}</p>
                      <p className="text-[11px] text-muted mt-0.5">{log.violation}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex-1 grid place-items-center text-muted font-dm text-sm">
                No telemetry alerts available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
