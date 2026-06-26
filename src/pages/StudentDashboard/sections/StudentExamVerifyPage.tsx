import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiAlertCircle, FiArrowLeft, FiCamera, FiCheck, FiRefreshCw, FiShield } from 'react-icons/fi';

type VerifyStep = 'idle' | 'starting' | 'scanning' | 'verified' | 'failed';

export default function StudentExamVerifyPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<VerifyStep>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  const exam = (() => {
    try { return JSON.parse(localStorage.getItem(`studentExam_${examId}`) ?? '{}'); } catch { return {}; }
  })();

  const startCamera = async () => {
    setCameraError(null);
    setStep('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStep('scanning');
    } catch {
      setCameraError('Cannot access camera. Please allow camera permission and try again.');
      setStep('failed');
    }
  };

  useEffect(() => {
    if (step !== 'scanning') return;
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) { clearInterval(interval); setStep('verified'); return 100; }
        return p + 2;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const stepIdx = step === 'idle' || step === 'starting' ? 0 : step === 'scanning' ? 1 : step === 'verified' ? 2 : 0;

  return (
    <div className="h-screen overflow-hidden bg-navy flex flex-col">
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-border bg-navy-card">
        <button
          onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); navigate(-1); }}
          className="flex items-center gap-2 text-muted text-sm hover:text-white-soft transition-colors cursor-pointer bg-transparent border-none"
        >
          <FiArrowLeft /> Back
        </button>
        <div className="text-center">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Identity Verification</p>
          <p className="font-syne font-bold text-white-soft text-sm">{exam.examName ?? 'Exam'}</p>
        </div>
        <div className="w-16" />
      </div>

      {/* ── Body: 2 columns ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — Camera */}
        <div className="flex-1 flex items-center justify-center bg-navy/50 p-8">
          <div className="relative w-full max-w-75">
            {/* Glow */}
            <div className={`absolute inset-0 rounded-[28px] blur-2xl transition-all duration-700 pointer-events-none ${
              step === 'verified' ? 'bg-green/25' : step === 'scanning' ? 'bg-blue/20' : 'bg-transparent'
            }`} />

            {/* Camera box — aspect ratio 4:5 */}
            <div className={`relative w-full aspect-4/5 rounded-[20px] overflow-hidden border-2 transition-all duration-500 ${
              step === 'verified' ? 'border-green shadow-[0_0_40px_rgba(34,197,94,0.25)]' :
              step === 'scanning' ? 'border-blue-bright shadow-[0_0_30px_rgba(99,179,237,0.2)]' :
              'border-border'
            }`}>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                muted playsInline autoPlay
              />

              {/* Idle */}
              {(step === 'idle' || step === 'starting') && (
                <div className="absolute inset-0 bg-navy/80 flex flex-col items-center justify-center gap-3">
                  {step === 'starting'
                    ? <div className="w-10 h-10 border-2 border-blue-bright/30 border-t-blue-bright rounded-full animate-spin" />
                    : <FiCamera className="text-4xl text-muted" />}
                  <p className="text-sm text-muted">{step === 'starting' ? 'Accessing camera…' : 'Camera not started'}</p>
                </div>
              )}

              {/* Scanning */}
              {step === 'scanning' && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[55%] h-[70%] rounded-full border-2 border-blue-bright/70 shadow-[0_0_20px_rgba(99,179,237,0.4)]" />
                  </div>
                  <div
                    className="absolute left-[12%] right-[12%] h-0.5 bg-linear-to-r from-transparent via-blue-bright to-transparent pointer-events-none"
                    style={{ top: `${10 + (scanProgress / 100) * 80}%`, opacity: 0.9 }}
                  />
                  {[['top-3 left-3 border-t-2 border-l-2'], ['top-3 right-3 border-t-2 border-r-2'], ['bottom-3 left-3 border-b-2 border-l-2'], ['bottom-3 right-3 border-b-2 border-r-2']].map(([cls], i) => (
                    <div key={i} className={`absolute w-4 h-4 border-blue-bright ${cls}`} />
                  ))}
                </>
              )}

              {/* Verified */}
              {step === 'verified' && (
                <div className="absolute inset-0 bg-green/10 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-green/20 border-2 border-green grid place-items-center shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                    <FiCheck className="text-green text-2xl" />
                  </div>
                  <p className="font-bold text-green text-sm">Identity Verified</p>
                </div>
              )}

              {/* Failed */}
              {step === 'failed' && (
                <div className="absolute inset-0 bg-navy/80 flex flex-col items-center justify-center gap-3 px-6">
                  <FiAlertCircle className="text-red text-3xl shrink-0" />
                  <p className="text-red text-sm font-semibold text-center">{cameraError}</p>
                </div>
              )}
            </div>

            {/* Scan progress bar */}
            {step === 'scanning' && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-muted">
                  <span>Scanning face…</span><span>{scanProgress}%</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-blue to-blue-bright rounded-full transition-all duration-75"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right — Info panel */}
        <div className="w-85 shrink-0 border-l border-border bg-navy-card flex flex-col justify-between p-8 overflow-y-auto">

          {/* Steps */}
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-4">Verification Steps</p>
              <div className="space-y-3">
                {(['Allow Camera', 'Scan Your Face', 'Ready to Start'] as const).map((label, i) => {
                  const done = i < stepIdx;
                  const active = i === stepIdx;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full border-2 grid place-items-center text-xs font-bold shrink-0 transition-all ${
                        done ? 'bg-green border-green text-white' :
                        active ? 'border-blue-bright text-blue-bright' :
                        'border-border text-muted'
                      }`}>
                        {done ? <FiCheck className="text-xs" /> : i + 1}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold transition-colors ${
                          done ? 'text-green' : active ? 'text-white-soft' : 'text-muted'
                        }`}>{label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status message */}
            <div className={`rounded-xl px-4 py-3 border text-sm transition-all ${
              step === 'verified' ? 'bg-green/10 border-green/30 text-green' :
              step === 'scanning' ? 'bg-blue/10 border-blue-bright/30 text-blue-bright' :
              step === 'failed' ? 'bg-red/10 border-red/30 text-red' :
              'bg-navy border-border text-muted'
            }`}>
              {step === 'idle' && 'Click the button below to start camera and verify your identity.'}
              {step === 'starting' && 'Opening camera, please wait…'}
              {step === 'scanning' && 'Look directly at the camera and keep still.'}
              {step === 'verified' && 'Identity verified! You can now start the exam.'}
              {step === 'failed' && (cameraError ?? 'Verification failed. Please retry.')}
            </div>

            {/* Rules */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <FiShield className="text-gold text-sm" />
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Before You Start</p>
              </div>
              {[
                'Ensure your face is well lit and clearly visible',
                'Do not wear sunglasses or hats during the exam',
                'Your camera will be active throughout the exam',
                'Suspicious activity may result in disqualification',
              ].map((rule) => (
                <div key={rule} className="flex items-start gap-2 text-xs text-muted">
                  <span className="text-gold mt-0.5 shrink-0">•</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action button — pinned at bottom */}
          <div className="pt-6">
            {(step === 'idle' || step === 'failed') && (
              <button
                onClick={step === 'failed' ? () => { streamRef.current?.getTracks().forEach((t) => t.stop()); startCamera(); } : startCamera}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold cursor-pointer transition-colors border text-sm ${
                  step === 'failed'
                    ? 'bg-gold/10 border-gold/30 text-gold hover:bg-gold/20'
                    : 'bg-blue border-blue text-white hover:bg-blue/80 border-none'
                }`}
              >
                {step === 'failed' ? <><FiRefreshCw /> Retry</> : <><FiCamera /> Start Camera Verification</>}
              </button>
            )}
            {step === 'verified' && (
              <button
                onClick={() => navigate(`/student/exams/${examId}/take`)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green text-white font-bold cursor-pointer hover:bg-green/80 transition-colors border-none text-sm shadow-[0_0_20px_rgba(34,197,94,0.3)]"
              >
                <FiCheck /> Start Exam Now
              </button>
            )}
            {(step === 'starting' || step === 'scanning') && (
              <div className="w-full py-3 rounded-xl border border-border text-muted text-sm text-center opacity-50">
                {step === 'starting' ? 'Opening camera…' : 'Verifying…'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
