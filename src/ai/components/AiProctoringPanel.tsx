import React, { useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle,
  FiCamera,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiEye,
  FiExternalLink,
  FiMaximize2,
  FiPauseCircle,
  FiPlayCircle,
  FiRefreshCw,
  FiShield,
  FiSliders,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import { useAiProctoring } from '../hooks/useAiProctoring';
import type { EvidenceItem, ProctoringFrameAnalysis, ViolationType } from '../types/proctoring';

function formatAngle(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return `${value.toFixed(1)} deg`;
}

function signalClass(type: ViolationType, analysis: ProctoringFrameAnalysis | null) {
  return analysis?.activeSignals.includes(type)
    ? 'border-red/35 bg-red/10 text-red'
    : 'border-border bg-navy/40 text-muted';
}

function formatPercent(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return `${Math.round(value * 100)}%`;
}

function formatRatio(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return value.toFixed(3);
}

function evidenceStatusLabel(status: string) {
  if (status === 'local') return 'Buffered locally';
  if (status === 'uploaded') return 'Uploaded';
  if (status === 'failed') return 'Upload failed';
  return 'Upload pending';
}

export default function AiProctoringPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const {
    analysis,
    cameraStatus,
    mediaPipeStatus,
    error,
    evidence,
    violations,
    isRunning,
    start,
    stop,
    clearLocalEvidence,
  } = useAiProctoring(videoRef);

  const statusLabel = useMemo(() => {
    if (error) return 'Attention required';
    if (isRunning) return 'Monitoring live';
    if (mediaPipeStatus === 'loading') return 'Loading model';
    if (cameraStatus === 'requesting') return 'Requesting camera';
    return 'Ready for local test';
  }, [cameraStatus, error, isRunning, mediaPipeStatus]);

  return (
    <div className="space-y-6">
      <div className="uni-page-banner rounded-[24px] p-6 relative overflow-hidden">
        <div className="uni-banner-grid absolute inset-0 z-0 opacity-40" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue to-cyan text-white flex items-center justify-center text-xl">
              <FiShield />
            </div>
            <div>
              <h1 className="font-syne text-2xl font-extrabold text-white-soft">AI Proctoring Prototype</h1>
              <p className="text-muted text-sm mt-0.5">
                Browser-only detection with rolling video evidence clips.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
              isRunning ? 'text-green border-green/25 bg-green/10' : 'text-cyan border-cyan/25 bg-cyan/10'
            }`}>
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={isRunning ? stop : start}
              className={isRunning ? 'uni-btn-danger' : 'uni-btn-primary'}
            >
              {isRunning ? <FiPauseCircle /> : <FiPlayCircle />}
              {isRunning ? 'Stop' : 'Start'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red/10 border border-red/25 rounded-2xl p-4 text-sm text-red flex items-center gap-3">
          <FiAlertTriangle className="text-lg shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)] gap-6">
        <div className="bg-navy-card border border-border rounded-[24px] p-4 space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-black aspect-video border border-border">
            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
            <div className="proctor-scanline" />
            <div className="absolute top-3 left-3 flex items-center gap-2 text-xs font-bold text-white bg-black/45 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur">
              <FiCamera />
              {cameraStatus}
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-2 text-xs font-bold text-white bg-black/45 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur">
              <FiRefreshCw className={mediaPipeStatus === 'loading' ? 'animate-spin' : ''} />
              {mediaPipeStatus}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard icon={<FiUser />} label="Faces" value={analysis ? String(analysis.faceCount) : '--'} />
            <MetricCard icon={<FiEye />} label="Head Turn" value={analysis?.headTurn?.active ? analysis.headTurn.direction : 'CENTER'} />
            <MetricCard icon={<FiCheckCircle />} label="Eye Diversion" value={analysis?.eyeDiversion?.active ? analysis.eyeDiversion.direction : 'CENTER'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard icon={<FiSliders />} label="Calibration" value={analysis?.calibration.status === 'ready' ? 'Ready' : formatPercent(analysis?.calibration.progress)} />
            <MetricCard label="Face Quality" value={formatPercent(analysis?.faceQuality?.score)} />
            <MetricCard label="Eye Gaze Raw" value={analysis?.eyeGaze?.direction ?? '--'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard label="Yaw" value={formatAngle(analysis?.headPose?.yaw)} />
            <MetricCard label="Pitch" value={formatAngle(analysis?.headPose?.pitch)} />
            <MetricCard label="Roll" value={formatAngle(analysis?.headPose?.roll)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard label="Left EAR" value={formatRatio(analysis?.faceQuality?.leftEyeAspectRatio)} />
            <MetricCard label="Right EAR" value={formatRatio(analysis?.faceQuality?.rightEyeAspectRatio)} />
            <MetricCard label="Sharpness" value={analysis?.faceQuality ? analysis.faceQuality.sharpness.toFixed(1) : '--'} />
          </div>

          {analysis?.faceQuality && (!analysis.faceQuality.acceptable || analysis.faceQuality.obstructed) && (
            <div className={`rounded-2xl p-4 text-xs leading-relaxed ${
              analysis.faceQuality.obstructed
                ? 'bg-red/10 border border-red/25 text-red'
                : 'bg-gold/10 border border-gold/25 text-gold'
            }`}>
              {analysis.faceQuality.obstructed ? 'Face obstructed' : 'Face quality note'}: {analysis.faceQuality.reasons.join(', ') || 'LOW_CONFIDENCE'}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-navy-card border border-border rounded-[24px] p-5 space-y-4">
            <h2 className="font-syne font-bold text-lg text-white-soft flex items-center gap-2">
              <FiAlertTriangle className="text-gold" />
              Violation Engine
            </h2>
            <div className="grid grid-cols-1 gap-2">
              <SignalPill icon={<FiUser />} label="Absence timer" className={signalClass('ABSENCE', analysis)} />
              <SignalPill icon={<FiUsers />} label="Multiple face timer" className={signalClass('MULTIPLE_FACE', analysis)} />
              <SignalPill icon={<FiAlertTriangle />} label="Face obstructed timer" className={signalClass('FACE_OBSTRUCTED', analysis)} />
              <SignalPill icon={<FiShield />} label="Head turn vote" className={signalClass('HEAD_TURN', analysis)} />
              <SignalPill icon={<FiEye />} label="Eye diversion vote" className={signalClass('EYE_DIVERSION', analysis)} />
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Head turn and eye diversion are evaluated independently with 1200ms temporal voting.
            </p>
          </div>

          <div className="bg-navy-card border border-border rounded-[24px] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-syne font-bold text-lg text-white-soft">Rolling Video Evidence</h2>
              <button type="button" className="uni-btn-ghost !text-xs !py-2 !px-3" onClick={clearLocalEvidence}>
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {evidence.length === 0 ? (
                <div className="col-span-2 py-8 text-center text-sm text-muted border border-dashed border-border rounded-2xl">
                  No evidence clips yet.
                </div>
              ) : (
                evidence.slice(0, 4).map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-border bg-navy/40">
                    {item.videoObjectUrl ? (
                      <button
                        type="button"
                        onClick={() => setSelectedEvidence(item)}
                        className="relative w-full aspect-video bg-black border-0 p-0 cursor-pointer group"
                        aria-label={`Open evidence clip ${item.violationType}`}
                      >
                        <video src={item.videoObjectUrl} className="w-full h-full object-cover" muted preload="metadata" />
                        <span className="absolute inset-0 grid place-items-center bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <FiMaximize2 />
                        </span>
                      </button>
                    ) : (
                      <div className="w-full aspect-video bg-black grid place-items-center text-[10px] text-muted">
                        Uploaded
                      </div>
                    )}
                    <div className="p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold text-cyan">{item.violationType}</div>
                        <span className="text-[9px] text-green bg-green/10 border border-green/20 rounded-full px-2 py-0.5">
                          {evidenceStatusLabel(item.uploadStatus)}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted flex items-center gap-1">
                        <FiClock />
                        Evidence Clip {Math.round(item.durationMs / 1000)}s - {(item.videoSizeBytes / 1024 / 1024).toFixed(2)} MB
                      </div>
                      <div className="text-[10px] text-muted">
                        Pre-event 5s + Post-event 5s - {item.violations.length} event{item.violations.length > 1 ? 's' : ''}
                      </div>
                      {item.violations.length > 1 && (
                        <div className="text-[10px] text-muted truncate">
                          Also includes {item.violations.slice(1).map((violation) => violation.violationType).join(', ')}
                        </div>
                      )}
                      {item.uploadError && <div className="text-[10px] text-red">{item.uploadError}</div>}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedEvidence(item)}
                          disabled={!item.videoObjectUrl}
                          className="uni-btn-ghost !text-[10px] !py-1.5 !px-2 disabled:opacity-40"
                        >
                          <FiMaximize2 />
                          View
                        </button>
                        {item.videoObjectUrl && (
                          <a href={item.videoObjectUrl} download={item.filename} className="uni-btn-ghost no-underline !text-[10px] !py-1.5 !px-2">
                            <FiDownload />
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-navy-card border border-border rounded-[24px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="font-syne font-bold text-lg text-white-soft">Violation Log</h2>
          <span className="text-xs text-muted">{violations.length} local events</span>
        </div>
        {violations.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">Events emitted by the local engine will appear here.</div>
        ) : (
          <div className="divide-y divide-border">
            {violations.map((event) => (
              <div key={event.id} className="px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <p className="font-syne font-bold text-white-soft text-sm">{event.label}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {event.type} - {(event.durationMs / 1000).toFixed(1)}s - gaze {event.metadata.gaze ?? '--'}
                    {event.metadata.faceQuality?.reasons.length ? ` - ${event.metadata.faceQuality.reasons.join(', ')}` : ''}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border w-fit ${
                  event.severity === 'critical' ? 'text-red border-red/25 bg-red/10' : 'text-gold border-gold/25 bg-gold/10'
                }`}>
                  {event.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEvidence && (
        <EvidenceViewer evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
      )}
    </div>
  );
}

function EvidenceViewer({ evidence, onClose }: { evidence: EvidenceItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl bg-navy-card border border-border rounded-[24px] overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-syne font-bold text-lg text-white-soft">{evidence.violationType} Evidence Clip</h2>
            <p className="text-xs text-muted mt-0.5">
              Pre-event 5s + post-event 5s - {evidence.violations.length} event{evidence.violations.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {evidence.videoObjectUrl && (
              <>
                <a href={evidence.videoObjectUrl} target="_blank" rel="noreferrer" className="uni-btn-ghost no-underline !text-xs !py-2 !px-3">
                  <FiExternalLink />
                  Open
                </a>
                <a href={evidence.videoObjectUrl} download={evidence.filename} className="uni-btn-ghost no-underline !text-xs !py-2 !px-3">
                  <FiDownload />
                  Download
                </a>
              </>
            )}
            <button type="button" onClick={onClose} className="uni-btn-danger !text-xs !py-2 !px-3">
              Close
            </button>
          </div>
        </div>

        <div className="bg-black">
          {evidence.videoObjectUrl ? (
            <div className="p-4 space-y-3">
              <video
                src={evidence.videoObjectUrl}
                className="w-full max-h-[70vh] bg-black"
                controls
                autoPlay
                preload="metadata"
                style={{ width: '100%', maxWidth: 500 }}
              />
              <div className="text-[11px] text-muted">
                Uploaded/Supabase status: {evidenceStatusLabel(evidence.uploadStatus)}
              </div>
            </div>
          ) : (
            <div className="aspect-video grid place-items-center text-muted">Video was uploaded and is not stored locally.</div>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {evidence.violations.map((violation) => (
            <div key={violation.violationId} className="bg-navy/40 border border-border rounded-2xl p-3">
              <div className="text-xs font-bold text-cyan">{violation.violationType}</div>
              <div className="text-[11px] text-muted mt-1">
                Direction {violation.direction ?? '--'} - Confidence {formatPercent(violation.confidence)}
              </div>
              <div className="text-[11px] text-muted">
                Duration {(violation.durationMs / 1000).toFixed(1)}s - Faces {violation.faceCount ?? '--'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-navy/40 border border-border/60 rounded-2xl p-4 min-h-[92px]">
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon}
        {label}
      </div>
      <p className="font-syne font-extrabold text-xl text-white-soft mt-2 break-words">{value}</p>
    </div>
  );
}

function SignalPill({ icon, label, className }: { icon: React.ReactNode; label: string; className: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${className}`}>
      {icon}
      {label}
    </div>
  );
}
