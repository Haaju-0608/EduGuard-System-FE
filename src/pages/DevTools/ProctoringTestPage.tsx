import { useRef, useState } from 'react';
import { FiActivity, FiAlertTriangle, FiCamera, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useAiProctoring } from '../../ai/hooks/useAiProctoring';
import type { ViolationEngineThresholds } from '../../ai/types/proctoring';

// Trang debug độc lập — KHÔNG đụng tới participationId/exam nào cả, không POST bất cứ gì lên
// /api/violation-logs thật (EvidenceRecorder vẫn cấu hình uploadUrl mặc định nhưng ta không cần
// quan tâm evidence ở đây, chỉ cần xem pipeline detect có chạy đúng không). Dùng để tìm nguyên
// nhân "sau khi đổi Proctoring Settings thì không còn bắt được violation" — hiện toàn bộ số liệu
// trung gian (ngưỡng đang áp dụng, tín hiệu thô, trạng thái calibration) mà màn thi thật không
// bao giờ lộ ra cho người dùng thấy.

const THRESHOLD_LABELS: Record<keyof ViolationEngineThresholds, string> = {
  absenceMs: 'Absence',
  multipleFaceMs: 'Multiple Faces',
  faceObstructedMs: 'Face Obstructed',
  headTurnMs: 'Head Turn',
  eyeDiversionMs: 'Gaze Diversion',
};

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'idle' }) {
  const cls =
    tone === 'ok' ? 'text-green bg-green/10 border-green/25' :
    tone === 'warn' ? 'text-gold bg-gold/10 border-gold/25' :
    'text-muted bg-white/5 border-border';
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-navy-card/60">
      <span className="text-[11px] text-muted uppercase tracking-wider font-bold">{label}</span>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{value}</span>
    </div>
  );
}

export default function ProctoringTestPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const proctoring = useAiProctoring(videoRef);
  const {
    analysis, cameraStatus, mediaPipeStatus, error, violations, isRunning,
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
          Chạy độc lập, không tạo exam/participation nào — chỉ để soi pipeline detect + ngưỡng
          đang áp dụng. Không có gì ở trang này được gửi lên hệ thống thật.
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
            <StatusPill label="Camera" value={cameraStatus} tone={cameraStatus === 'ready' ? 'ok' : cameraStatus === 'idle' ? 'idle' : 'warn'} />
            <StatusPill label="MediaPipe" value={mediaPipeStatus} tone={mediaPipeStatus === 'ready' ? 'ok' : mediaPipeStatus === 'idle' ? 'idle' : 'warn'} />
            <StatusPill
              label="Settings source"
              value={thresholdsSource === 'server' ? 'server (custom)' : thresholdsSource === 'error' ? 'fetch failed' : 'hard-coded default'}
              tone={thresholdsSource === 'server' ? 'ok' : thresholdsSource === 'error' ? 'warn' : 'idle'}
            />
            <StatusPill
              label="Calibration"
              value={analysis ? `${analysis.calibration.status} (${Math.round(analysis.calibration.progress * 100)}%)` : '—'}
              tone={analysis?.calibration.status === 'ready' ? 'ok' : 'warn'}
            />
          </div>

          {/* Active thresholds — cái quan trọng nhất để debug "không bắt được violation nữa" */}
          <div className="bg-navy-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-bold text-white-soft">Active thresholds (đang chạy thật)</p>
              <p className="text-[11px] text-muted mt-0.5">
                Nếu số này quá lớn (vd &gt; 10 000ms) so với ý bạn cấu hình, đó là chỗ đang sai —
                không phải ở camera/model.
              </p>
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

        {/* Live analysis + violation log */}
        <div className="space-y-4">
          <div className="bg-navy-card border border-border rounded-2xl p-4">
            <p className="text-sm font-bold text-white-soft mb-3">Live signal (mỗi ~120ms)</p>
            {!analysis ? (
              <p className="text-muted text-sm">Chưa có dữ liệu — bấm Start và đợi camera lên.</p>
            ) : (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-muted">Face count</span><span className="font-mono text-white-soft">{analysis.faceCount}</span></div>
                <div className="flex justify-between"><span className="text-muted">Head pose (yaw / pitch / roll)</span>
                  <span className="font-mono text-white-soft">
                    {analysis.headPose ? `${analysis.headPose.yaw.toFixed(1)} / ${analysis.headPose.pitch.toFixed(1)} / ${analysis.headPose.roll.toFixed(1)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-muted">Eye gaze</span>
                  <span className="font-mono text-white-soft">{analysis.eyeGaze ? `${analysis.eyeGaze.direction} (${(analysis.eyeGaze.confidence * 100).toFixed(0)}%)` : '—'}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted">Face quality</span>
                  <span className="font-mono text-white-soft">{analysis.faceQuality ? (analysis.faceQuality.obstructed ? 'obstructed' : `ok (${analysis.faceQuality.score.toFixed(2)})`) : '—'}</span>
                </div>
                <div>
                  <span className="text-muted">Active signals (trước ngưỡng thời gian)</span>
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

          <div className="bg-navy-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-bold text-white-soft">Violations fired ({violations.length})</p>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
              {violations.length === 0 ? (
                <p className="text-muted text-sm p-4">Chưa có vi phạm nào được ViolationEngine bắn ra.</p>
              ) : violations.map((v) => (
                <div key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white-soft font-medium">{v.label}</p>
                    <p className="text-[11px] text-muted">held for {v.durationMs}ms · {v.severity}</p>
                  </div>
                  <span className="text-[11px] text-muted font-mono shrink-0">
                    {new Date(v.emittedAt + (Date.now() - performance.now())).toLocaleTimeString('en-GB')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
