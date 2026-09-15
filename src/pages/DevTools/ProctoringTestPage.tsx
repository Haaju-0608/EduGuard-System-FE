import { useRef, useState } from 'react';
import { FiActivity, FiAlertTriangle, FiCamera, FiClock, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useAiProctoring } from '../../ai/hooks/useAiProctoring';
import type { ViolationEngineThresholds } from '../../ai/types/proctoring';

// Trang debug độc lập — KHÔNG đụng tới exam nào cả. Dùng để kiểm 3 việc đang được sửa:
// 1. Video evidence có mượt hơn không, đúng ~8s không (không còn dài ~20s giật lag).
// 2. Có đúng "xử lý xong 1 violation mới bắt cái tiếp theo" không (EvidenceRecorder.isBusy).
// 3. Mọi violation hiện ra ở đây có ĐỦ video không (không còn violation "rỗng" như trước).
// Vẫn POST thật lên /api/violation-logs (dùng participationId giả nếu không set) + upload evidence
// thật lên Storage — chỉ không gắn với exam/participation thật nào, xem kỹ trước khi dùng chung
// participationId của 1 bài thi thật để tránh cộng nhầm số vào bài thi đó.

const THRESHOLD_LABELS: Record<keyof ViolationEngineThresholds, string> = {
  absenceMs: 'Absence',
  multipleFaceMs: 'Multiple Faces',
  faceObstructedMs: 'Face Obstructed',
  headTurnMs: 'Head Turn',
  eyeDiversionMs: 'Gaze Diversion',
};

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ProctoringTestPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const proctoring = useAiProctoring(videoRef);
  const {
    analysis, cameraStatus, mediaPipeStatus, error, evidence, violations, isRunning,
    thresholdsSource, activeThresholds, start, stop, applyProctoringSettings, clearLocalEvidence,
  } = proctoring;

  const [institutionId, setInstitutionId] = useState(user?.institutionId ?? '');
  const [reloading, setReloading] = useState(false);

  const handleStart = async () => {
    await applyProctoringSettings(institutionId || null);
    await start();
  };

  const handleReloadSettings = async () => {
    setReloading(true);
    try {
      await applyProctoringSettings(institutionId || null);
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy p-6 space-y-6">
      <div>
        <h1 className="font-syne text-2xl font-extrabold text-white-soft flex items-center gap-2">
          <FiActivity className="text-blue-bright" /> AI Proctoring — Test Bench
        </h1>
        <p className="text-muted text-sm mt-1">
          Không tạo exam/participation nào — chỉ để xem evidence có mượt, đúng thời gian, và có
          video đầy đủ không. Bấm Start rồi thử tạo vài vi phạm liên tiếp (quay đầu vài lần) để xem
          nó có tự bỏ qua violation mới trong lúc đang xử lý cái trước không.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Camera + controls */}
        <div className="space-y-4">
          <div className="bg-navy-card border border-border rounded-2xl overflow-hidden aspect-video relative">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!isRunning && (
              <div className="absolute inset-0 grid place-items-center bg-navy/80">
                <FiCamera className="text-4xl text-muted" />
              </div>
            )}
          </div>

          <div className="bg-navy-card border border-border rounded-2xl p-4 space-y-3">
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider">
              Institution ID (để trống = dùng system default)
            </label>
            <input
              type="text"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              placeholder={user?.institutionId ?? 'institution guid'}
              className="w-full bg-navy border border-border rounded-xl px-3 py-2 text-sm text-white-soft outline-none focus:border-blue-bright/50 font-mono"
            />
            <div className="flex items-center gap-2 pt-1">
              {!isRunning ? (
                <button
                  onClick={() => void handleStart()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
                >
                  Start camera + detection
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red text-white text-sm font-semibold cursor-pointer hover:bg-red/80 transition-colors border-none"
                >
                  Stop
                </button>
              )}
              <button
                onClick={() => void handleReloadSettings()}
                disabled={reloading}
                title="Fetch GET /api/proctoring-settings/effective again and re-apply thresholds without restarting the camera"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-border-strong transition-colors bg-transparent disabled:opacity-50"
              >
                <FiRefreshCw className={reloading ? 'animate-spin' : ''} /> Reload settings
              </button>
              <button
                onClick={clearLocalEvidence}
                className="px-3 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft transition-colors bg-transparent"
              >
                Clear log
              </button>
            </div>
            {error && (
              <p className="text-red text-xs flex items-center gap-1.5"><FiAlertTriangle /> {error}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Camera', value: cameraStatus, ok: cameraStatus === 'ready' },
              { label: 'MediaPipe', value: mediaPipeStatus, ok: mediaPipeStatus === 'ready' },
              { label: 'Settings source', value: thresholdsSource === 'server' ? 'server (custom)' : thresholdsSource === 'error' ? 'fetch failed' : 'default', ok: thresholdsSource === 'server' },
              {
                label: 'Recorder',
                value: proctoring.evidence.some((e) => e.uploadStatus === 'pending') ? 'busy (recording clip…)' : 'idle — ready to catch',
                ok: !proctoring.evidence.some((e) => e.uploadStatus === 'pending'),
              },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-navy-card/60">
                <span className="text-[11px] text-muted uppercase tracking-wider font-bold">{s.label}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${s.ok ? 'text-green bg-green/10 border-green/25' : 'text-gold bg-gold/10 border-gold/25'}`}>{s.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-navy-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-bold text-white-soft">Active thresholds (đang chạy thật)</p>
            </div>
            <div className="divide-y divide-border">
              {activeThresholds && Object.entries(activeThresholds).map(([key, ms]) => (
                <div key={key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-white-soft">{THRESHOLD_LABELS[key as keyof ViolationEngineThresholds]}</span>
                  <span className="text-sm font-mono text-blue-bright">{ms} ms <span className="text-muted">({(ms / 1000).toFixed(2)}s)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live analysis + evidence with playable video */}
        <div className="space-y-4">
          <div className="bg-navy-card border border-border rounded-2xl p-4">
            <p className="text-sm font-bold text-white-soft mb-3">Live signal</p>
            {!analysis ? (
              <p className="text-muted text-sm">Chưa có dữ liệu — bấm Start và đợi camera lên.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Face count</span><span className="font-mono text-white-soft">{analysis.faceCount}</span></div>
                <div className="flex justify-between"><span className="text-muted">Calibration</span><span className="font-mono text-white-soft">{analysis.calibration.status} ({Math.round(analysis.calibration.progress * 100)}%)</span></div>
                <div>
                  <span className="text-muted">Active signals</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {analysis.activeSignals.length === 0 ? (
                      <span className="text-[11px] text-muted">none</span>
                    ) : analysis.activeSignals.map((s) => (
                      <span key={s} className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-gold/25 bg-gold/10 text-gold">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-navy-card border border-border rounded-2xl p-3 flex items-center justify-between">
            <p className="text-sm font-bold text-white-soft">Violations detected: {violations.length}</p>
            <p className="text-sm font-bold text-white-soft flex items-center gap-1.5"><FiClock /> Evidence clips: {evidence.length}</p>
          </div>

          <div className="bg-navy-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-bold text-white-soft">Evidence — mỗi clip phải có video, ~8s, không giật</p>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
              {evidence.length === 0 ? (
                <p className="text-muted text-sm p-4">Chưa có evidence nào — tạo vi phạm để xem (quay đầu / rời khỏi khung hình vài giây).</p>
              ) : evidence.map((item) => (
                <div key={item.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white-soft">{item.violationType}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      item.uploadStatus === 'uploaded' ? 'text-green bg-green/10 border-green/25'
                        : item.uploadStatus === 'failed' ? 'text-red bg-red/10 border-red/25'
                        : 'text-gold bg-gold/10 border-gold/25'
                    }`}>{item.uploadStatus}</span>
                  </div>
                  <p className="text-[11px] text-muted">
                    {fmtTime(item.capturedAt)} · duration {(item.durationMs / 1000).toFixed(1)}s · {(item.videoSizeBytes / 1024).toFixed(0)} KB
                  </p>
                  {item.videoObjectUrl ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={item.videoObjectUrl} controls className="w-full rounded-lg border border-border" />
                  ) : (
                    <p className="text-red text-xs">No video (this should not happen anymore — flag it).</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
