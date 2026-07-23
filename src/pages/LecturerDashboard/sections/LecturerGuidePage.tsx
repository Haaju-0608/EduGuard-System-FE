import type { ReactNode } from 'react';
import {
  FiAlertTriangle, FiCheckCircle, FiCompass, FiEye, FiFlag,
  FiInfo, FiShield, FiTarget, FiXCircle,
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

function Bullet({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-bright shrink-0 mt-1.5" />
      <span className="text-sm text-white-soft/90 leading-relaxed">{label}</span>
    </li>
  );
}

function SeverityBadge({ severity }: { severity: 'Warning' | 'Severe' }) {
  return severity === 'Severe' ? (
    <span className="text-[10px] font-bold text-red bg-red/10 border border-red/25 px-2 py-0.5 rounded-full whitespace-nowrap">Severe</span>
  ) : (
    <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full whitespace-nowrap">Warning</span>
  );
}

// ─── Violation overview table ──────────────────────────────────────────────

interface OverviewRow {
  violation: string;
  severity: 'Warning' | 'Severe';
  trigger: string;
  evidence: string;
  action: string;
}

const OVERVIEW_ROWS: OverviewRow[] = [
  { violation: 'Eye Diversion', severity: 'Warning', trigger: '≥1.5s continuous', evidence: 'Video clip + confidence score', action: 'Review clip; dismiss if reading/thinking, confirm if repeated' },
  { violation: 'Head Turn', severity: 'Warning', trigger: '≥1.2s continuous', evidence: 'Video clip + confidence score', action: 'Same as above' },
  { violation: 'Multiple Faces', severity: 'Severe', trigger: '≥1.2s continuous', evidence: 'Video clip', action: 'Review promptly; confirm if a second person is visible' },
  { violation: 'Face Obstructed', severity: 'Warning', trigger: '≥1.8s continuous', evidence: 'Video clip', action: 'Review for benign cause before confirming' },
  { violation: 'Absence', severity: 'Severe', trigger: '≥1.2s continuous', evidence: 'Video clip', action: 'Review promptly; confirm if student genuinely left frame' },
  { violation: 'Tab Switch', severity: 'Warning', trigger: 'Instant', evidence: 'Timestamp only', action: 'Counts toward 3-strike termination' },
  { violation: 'Window Blur', severity: 'Warning', trigger: 'Instant', evidence: 'Timestamp only', action: 'Counts toward 3-strike termination' },
  { violation: 'Exit Fullscreen', severity: 'Warning', trigger: 'Instant', evidence: 'Timestamp only', action: 'Counts toward 3-strike termination' },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LecturerGuidePage() {
  return (
    <div className="space-y-6">
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <h1 className="font-syne text-2xl font-extrabold text-white-soft">AI Proctoring Guide</h1>
        <p className="text-muted text-sm mt-1.5 leading-relaxed">
          How AI-detected violations work, what evidence you get, and how to review it.
        </p>
      </div>

      {/* 1. Purpose */}
      <Section icon={<FiTarget size={16} />} title="1. Purpose">
        <p className="text-sm text-white-soft/90 leading-relaxed">
          The AI supports monitoring; it does not conclude cheating. Every violation requires your review,
          and the final decision is always yours.
        </p>
      </Section>

      {/* 2. Violation Overview */}
      <Section icon={<FiAlertTriangle size={16} />} title="2. Violation Overview">
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider py-2 pr-3">Violation</th>
                <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider py-2 pr-3">Severity</th>
                <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider py-2 pr-3">Trigger</th>
                <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider py-2 pr-3">Evidence</th>
                <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider py-2">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {OVERVIEW_ROWS.map((row) => (
                <tr key={row.violation} className="border-b border-border/40 last:border-0 align-top">
                  <td className="py-2.5 pr-3 text-white-soft font-semibold whitespace-nowrap">{row.violation}</td>
                  <td className="py-2.5 pr-3"><SeverityBadge severity={row.severity} /></td>
                  <td className="py-2.5 pr-3 text-muted font-mono text-xs whitespace-nowrap">{row.trigger}</td>
                  <td className="py-2.5 pr-3 text-muted text-xs">{row.evidence}</td>
                  <td className="py-2.5 text-white-soft/80 text-xs leading-relaxed">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-3">
          Identity Verification/Impersonation and Device Policy are intentionally excluded — both are
          documented in the SRS as planned but not yet active in the current build.
        </p>
      </Section>

      {/* 3. How AI Detection Works */}
      <Section icon={<FiEye size={16} />} title="3. How AI Detection Works">
        <p className="text-sm text-white-soft/90 leading-relaxed">
          The AI continuously monitors webcam frames client-side in the student's browser. A violation is
          only raised once the abnormal state has persisted beyond its threshold; short accidental
          movements do not trigger a violation. Browser-integrity violations are the exception — they are
          detected instantly on occurrence, since there is no "brief and natural" version of switching tabs.
        </p>
      </Section>

      {/* 4. Severity Levels */}
      <Section icon={<FiFlag size={16} />} title="4. Severity Levels">
        <ul className="space-y-2.5 mb-3">
          <li className="flex items-start gap-2.5">
            <SeverityBadge severity="Warning" />
            <span className="text-sm text-white-soft/90 leading-relaxed">A minor indicator; review alongside other flags for the same student.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <SeverityBadge severity="Severe" />
            <span className="text-sm text-white-soft/90 leading-relaxed">A higher-confidence integrity concern; prioritize review.</span>
          </li>
        </ul>
        <p className="text-xs text-muted">
          Severity is fixed per violation type by the system — there is no escalation from Warning to
          Severe based on repeat count, even across many occurrences in one exam.
        </p>
      </Section>

      {/* 5. Browser Integrity */}
      <Section icon={<FiCompass size={16} />} title="5. Browser Integrity">
        <p className="text-sm text-white-soft/90 leading-relaxed">
          Tab switch, window blur, and exit fullscreen are tracked independently of AI detection, always
          recorded as Warning by the system (never by the client). Once a student accumulates 3 such
          violations in one exam, their participation is automatically terminated — you, the student, and
          the dashboard all receive a real-time notification.
        </p>
      </Section>

      {/* 6. How to Review Evidence */}
      <Section icon={<FiShield size={16} />} title="6. How to Review Evidence">
        <p className="text-sm text-white-soft/90 leading-relaxed mb-3">
          Each record includes violation type, timestamp, student, a video clip (AI violations only —
          browser violations have no video), and a review status you can update.
        </p>
        <p className="text-sm text-white-soft/90 leading-relaxed">
          Confidence scores are populated for Eye Diversion and Head Turn only; Absence, Multiple Faces,
          and Face Obstructed do not carry a reliable confidence value — evaluate those from the video,
          not the score.
        </p>
      </Section>

      {/* 7. Recommended Actions */}
      <Section icon={<FiCheckCircle size={16} />} title="7. Recommended Actions">
        <ul className="space-y-2.5">
          <Bullet label="Warning: review when convenient; dismiss if benign, confirm if suspicious." />
          <Bullet label="Severe: prioritize review promptly." />
          <Bullet label="Multiple violations in sequence: review together for context." />
          <Bullet label="Suspected false positive: mark as rejected; recurring false positives (e.g. persistent poor lighting) should be raised with School Admin, since there is no automatic threshold self-adjustment." />
        </ul>
      </Section>

      {/* 8. Common False Positive Cases */}
      <Section icon={<FiXCircle size={16} />} title="8. Common False Positive Cases">
        <ul className="space-y-2.5">
          <Bullet label="Poor/uneven lighting." />
          <Bullet label="Low webcam resolution." />
          <Bullet label="Sitting too close or too far from camera." />
          <Bullet label="Brief natural obstruction (glasses, coughing)." />
          <Bullet label="Network lag delaying evidence upload." />
        </ul>
      </Section>

      {/* 9. Best Practices */}
      <Section icon={<FiInfo size={16} />} title="9. Best Practices">
        <ul className="space-y-2.5">
          <Bullet label="Check the live dashboard periodically during exams." />
          <Bullet label="Treat a single Warning as informational; repeated Warnings or any Severe as worth reviewing." />
          <Bullet label="Dismiss confirmed false positives promptly." />
          <Bullet label="Escalate to School Admin for disputes or suspected system-wide issues rather than individual behavior." />
        </ul>
      </Section>
    </div>
  );
}
