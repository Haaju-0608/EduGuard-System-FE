import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cameraService } from '../camera/CameraService';
import { CalibrationEngine } from '../engines/CalibrationEngine';
import { DiversionSignalEngine } from '../engines/DiversionSignalEngine';
import { EyeGazeEngine } from '../engines/EyeGazeEngine';
import { FaceQualityEngine } from '../engines/FaceQualityEngine';
import { HeadPoseEngine } from '../engines/HeadPoseEngine';
import { TemporalFilterEngine } from '../engines/TemporalFilterEngine';
import { ViolationEngine } from '../engines/ViolationEngine';
import { EvidenceRecorder } from '../services/EvidenceRecorder';
import { mediaPipeFaceLandmarkerService } from '../services/MediaPipeFaceLandmarkerService';
import type {
  CameraStatus,
  EvidenceItem,
  MediaPipeStatus,
  ProctoringFrameAnalysis,
  ViolationEvent,
} from '../types/proctoring';
import { getMatrixData } from '../utils/landmarkGeometry';

const FRAME_INTERVAL_MS = 1000 / 30;
const UI_UPDATE_INTERVAL_MS = 120;

export function useAiProctoring(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [mediaPipeStatus, setMediaPipeStatus] = useState<MediaPipeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [analysis, setAnalysis] = useState<ProctoringFrameAnalysis | null>(null);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const engines = useMemo(
    () => ({
      calibration: new CalibrationEngine(),
      diversion: new DiversionSignalEngine(),
      faceQuality: new FaceQualityEngine(),
      filter: new TemporalFilterEngine(),
      headPose: new HeadPoseEngine(),
      eyeGaze: new EyeGazeEngine(),
      violation: new ViolationEngine(),
      evidence: new EvidenceRecorder({
        // Không phải secret — cùng 1 giá trị cho mọi máy, không cần .env.local mới chạy được.
        // .env.local vẫn có thể override khi cần trỏ sang backend khác để test.
        uploadUrl: import.meta.env.VITE_FASTAPI_EVIDENCE_URL ?? '/api/violation-logs',
        participationId: import.meta.env.VITE_AI_PARTICIPATION_ID,
        sessionId: import.meta.env.VITE_AI_SESSION_ID,
        studentId: import.meta.env.VITE_AI_STUDENT_ID,
      }),
    }),
    [],
  );

  const rafIdRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastFrameAtRef = useRef(0);
  const lastUiUpdateAtRef = useRef(0);
  const evidenceRef = useRef<EvidenceItem[]>([]);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);

    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const processFrame = useCallback(
    (timestamp: number) => {
      if (!runningRef.current) return;

      const video = videoRef.current;
      if (!video) {
        stopLoop();
        return;
      }

      if (timestamp - lastFrameAtRef.current >= FRAME_INTERVAL_MS) {
        lastFrameAtRef.current = timestamp;

          const result = mediaPipeFaceLandmarkerService.detectForVideo(video, timestamp);
          if (result) {
            const faceCount = result.faceLandmarks.length;
            if (faceCount !== 1) {
              engines.filter.reset();
            }

            const landmarks = result.faceLandmarks[0] ?? [];
            const matrixData = getMatrixData(result.facialTransformationMatrixes[0]);
            const rawHeadPose = faceCount === 1 ? engines.headPose.estimate(landmarks, matrixData) : null;
          const headPose = engines.filter.smoothHeadPose(rawHeadPose);
          const rawEyeGaze = faceCount === 1 ? engines.eyeGaze.estimate(landmarks) : null;
          const eyeGaze = engines.filter.smoothEyeGaze(rawEyeGaze);
          const faceQuality = faceCount === 1
            ? engines.faceQuality.estimate({
                video,
                landmarks,
                headPose,
                blendshapes: result.faceBlendshapes[0],
              })
            : null;
          const calibration = faceCount === 1
            ? engines.calibration.update({ timestamp, headPose, eyeGaze, faceQuality })
            : engines.calibration.getState();
          const headTurn = engines.diversion.detectHeadTurn({
            headPose,
            faceQuality,
            calibration: calibration.profile,
          });
          const eyeDiversion = engines.diversion.detectEyeDiversion({
            headTurn,
            eyeGaze,
            faceQuality,
            calibration: calibration.profile,
          });

          const evaluation = engines.violation.evaluate({
            timestamp,
            faceCount,
            eyeGaze,
            headTurn,
            eyeDiversion,
            headPose,
            faceQuality,
            calibration,
          });

          if (evaluation.events.length > 0) {
            setViolations((current) => [...evaluation.events, ...current].slice(0, 25));
            evaluation.events.forEach((event) => {
              engines.evidence.recordEvidence(event).then((captured) => {
                if (!captured) return;

                setEvidence((current) => {
                  const next = [captured, ...current].slice(0, 20);
                  engines.evidence.releaseEvidence(current.filter((item) => !next.includes(item)));

                  return next;
                });
              });
            });
          }

          if (timestamp - lastUiUpdateAtRef.current >= UI_UPDATE_INTERVAL_MS) {
            lastUiUpdateAtRef.current = timestamp;
            setAnalysis(evaluation.analysis);
          }
        }
      }

      rafIdRef.current = window.requestAnimationFrame(processFrame);
    },
    [engines, stopLoop, videoRef],
  );

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);

    // ── Camera ──
    try {
      setCameraStatus('requesting');
      const stream = await cameraService.start(video);
      engines.evidence.start(stream);
      setCameraStatus('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to access camera.';
      setError(message);
      setCameraStatus(message.toLowerCase().includes('permission') ? 'blocked' : 'error');
      return;
    }

    // ── MediaPipe ──
    try {
      setMediaPipeStatus('loading');
      await mediaPipeFaceLandmarkerService.initialize();
      setMediaPipeStatus('ready');

      engines.calibration.reset();
      engines.calibration.start(performance.now());
      engines.filter.reset();
      engines.violation.reset();
      runningRef.current = true;
      setIsRunning(true);
      rafIdRef.current = window.requestAnimationFrame(processFrame);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start AI proctoring.';
      setError(message);
      setMediaPipeStatus('error');
      stopLoop();
      // Camera stays active so the student's feed remains visible
    }
  }, [engines.calibration, engines.evidence, engines.filter, engines.violation, processFrame, stopLoop, videoRef]);

  const stop = useCallback(() => {
    stopLoop();
    engines.evidence.stop();
    cameraService.stop();
    engines.calibration.reset();
    engines.filter.reset();
    engines.violation.reset();
    setCameraStatus('idle');
  }, [engines.calibration, engines.evidence, engines.filter, engines.violation, stopLoop]);

  const updateProctoringConfig = useCallback(
    (opts: { participationId?: string; studentId?: string; sessionId?: string }) => {
      engines.evidence.updateConfig(opts);
    },
    [engines.evidence],
  );

  const clearLocalEvidence = useCallback(() => {
    setViolations([]);
    setEvidence((current) => {
      engines.evidence.releaseEvidence(current);
      evidenceRef.current = [];
      return [];
    });
  }, [engines.evidence]);

  useEffect(() => {
    evidenceRef.current = evidence;
  }, [evidence]);

  useEffect(() => () => {
    stop();
    engines.evidence.releaseEvidence(evidenceRef.current);
  }, [engines.evidence, stop]);

  return {
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
    updateProctoringConfig,
  };
}
