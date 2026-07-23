import type { ReactNode } from 'react';
import {
  FiAlertTriangle, FiCamera, FiCheck, FiEye, FiInfo, FiLock,
  FiMonitor, FiShield, FiSun, FiWifi, FiX,
} from 'react-icons/fi';

// ─── Shared building blocks ────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="bg-navy-card border border-border rounded-[20px] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-blue/10 border border-blue/30 grid place-items-center text-blue-bright shrink-0">
          {icon}
        </div>
        <h2 className="font-syne font-bold text-white-soft text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <FiCheck className="text-green shrink-0 mt-0.5" size={14} />
      <span className="text-sm text-white-soft/90 leading-relaxed">{label}</span>
    </li>
  );
}

function DontItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <FiX className="text-red shrink-0 mt-0.5" size={14} />
      <span className="text-sm text-white-soft/90 leading-relaxed">{label}</span>
    </li>
  );
}

// ─── Violation threshold table ─────────────────────────────────────────────

interface ViolationRow {
  behavior: string;
  threshold: string;
  result: 'Warning' | 'Severe';
}

const VIOLATION_ROWS: ViolationRow[] = [
  { behavior: 'Looking away from the screen', threshold: '≥1.5s continuous', result: 'Warning' },
  { behavior: 'Turning head away from the screen', threshold: '≥1.2s continuous', result: 'Warning' },
  { behavior: 'Face covered/obstructed', threshold: '≥1.8s continuous', result: 'Warning' },
  { behavior: 'No face detected', threshold: '≥1.2s continuous', result: 'Severe' },
  { behavior: 'More than one face detected', threshold: '≥1.2s continuous', result: 'Severe' },
  { behavior: 'Switching browser tab', threshold: 'Instant', result: 'Warning' },
  { behavior: 'App/window loses focus', threshold: 'Instant', result: 'Warning' },
  { behavior: 'Exiting fullscreen', threshold: 'Instant', result: 'Warning' },
];

function ResultBadge({ result }: { result: ViolationRow['result'] }) {
  return result === 'Severe' ? (
    <span className="text-[10px] font-bold text-red bg-red/10 border border-red/25 px-2 py-0.5 rounded-full whitespace-nowrap">Severe</span>
  ) : (
    <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full whitespace-nowrap">Warning</span>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StudentGuidePage() {
  return (
    <div className="space-y-6">
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <h1 className="font-syne text-2xl font-extrabold text-white-soft">Exam Proctoring Guide</h1>
        <p className="text-muted text-sm mt-1.5 leading-relaxed">
          What to expect before and during a proctored exam, how AI monitoring works, and how your data is handled.
        </p>
      </div>

      {/* 1. Before Starting */}
      <Section icon={<FiMonitor size={16} />} title="1. Before Starting">
        <ul className="space-y-2.5">
          <CheckItem label="Camera: minimum 720p HD (1280×720) @ 30fps. VGA cameras are not supported." />
          <CheckItem label="Browser: Chrome 85+, Edge 85+, or Safari 15+." />
          <CheckItem label="Fullscreen: required — you will be prompted to enter fullscreen before the exam starts." />
          <CheckItem label="Internet: a stable connection is recommended; your exam status is automatically restored if you refresh or briefly disconnect." />
          <CheckItem label="Lighting: sit in a well-lit space (recommended minimum ~300 lux); avoid strong backlighting or dark rooms." />
        </ul>
      </Section>

      {/* 2. During the Exam */}
      <Section icon={<FiCamera size={16} />} title="2. During the Exam">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          <ul className="space-y-2.5">
            <CheckItem label="Sit directly facing the camera with your full face visible." />
          </ul>
          <ul className="space-y-2.5">
            <DontItem label="Do not cover your face." />
            <DontItem label="Do not leave the camera's field of view." />
            <DontItem label="Avoid turning your head or looking away from the screen for extended periods." />
            <DontItem label="Do not allow another person to appear in frame." />
            <DontItem label="Do not switch browser tabs." />
            <DontItem label="Do not exit fullscreen." />
            <DontItem label="Do not switch to another application." />
          </ul>
        </div>
      </Section>

      {/* 3. How AI Monitoring Works */}
      <Section icon={<FiEye size={16} />} title="3. How AI Monitoring Works">
        <p className="text-sm text-white-soft/90 leading-relaxed">
          The AI does not react to the instant something looks unusual. It watches continuously, and only
          records a violation when an unusual state persists longer than a set duration — brief, natural
          actions (blinking, glancing down, adjusting glasses) are not flagged. Your webcam is not
          continuously recorded; only short video clips around a detected violation are saved as evidence.
        </p>
      </Section>

      {/* 4. Warning and Violations */}
      <Section icon={<FiAlertTriangle size={16} />} title="4. Warning and Violations">
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider py-2 pr-3">Behavior</th>
                <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider py-2 pr-3">Threshold</th>
                <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {VIOLATION_ROWS.map((row) => (
                <tr key={row.behavior} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-3 text-white-soft/90">{row.behavior}</td>
                  <td className="py-2.5 pr-3 text-muted font-mono text-xs">{row.threshold}</td>
                  <td className="py-2.5"><ResultBadge result={row.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-3">
          Tab switch, window focus loss, and exiting fullscreen each count toward a 3-strike limit —
          reaching 3 total ends the exam automatically.
        </p>
      </Section>

      {/* 5. Tips to Avoid False Violations */}
      <Section icon={<FiSun size={16} />} title="5. Tips to Avoid False Violations">
        <ul className="space-y-2.5">
          <CheckItem label="Keep a natural distance from the camera — not too close, not too far." />
          <CheckItem label="Avoid dark rooms or strong light behind you." />
          <CheckItem label="Don't cover the camera lens." />
          <CheckItem label="Keep your whole face visible and stay centered in frame." />
          <CheckItem label="Minimize unnecessary head movement." />
          <CheckItem label="Stay in fullscreen and on the exam tab the entire time." />
        </ul>
      </Section>

      {/* 6. Privacy Notice */}
      <Section icon={<FiLock size={16} />} title="6. Privacy Notice">
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2.5">
            <FiShield className="text-cyan shrink-0 mt-0.5" size={14} />
            <span className="text-sm text-white-soft/90 leading-relaxed">Your face is converted into a 128-dimensional feature vector; the raw registration photo is deleted after this vector is extracted.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <FiCamera className="text-cyan shrink-0 mt-0.5" size={14} />
            <span className="text-sm text-white-soft/90 leading-relaxed">Evidence video clips are only created when a violation is detected — ordinary exam video is not stored.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <FiInfo className="text-cyan shrink-0 mt-0.5" size={14} />
            <span className="text-sm text-white-soft/90 leading-relaxed">Evidence is retained for a limited review period and then permanently deleted.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <FiWifi className="text-cyan shrink-0 mt-0.5" size={14} />
            <span className="text-sm text-white-soft/90 leading-relaxed">Your data is protected in transit via HTTPS; access is restricted to authorized institution staff.</span>
          </li>
        </ul>
      </Section>
    </div>
  );
}
