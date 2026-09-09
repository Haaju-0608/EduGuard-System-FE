import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../services/apiClient';
import { fetchEffectiveProctoringSettings } from '../../services/schoolAdminApi';
import type { ProctoringViolationTypeThreshold } from '../../types/termination';
import { cameraService } from '../camera/CameraService';
import { CalibrationEngine } from '../engines/CalibrationEngine';
import { DiversionSignalEngine } from '../engines/DiversionSignalEngine';
import { EyeGazeEngine } from '../engines/EyeGazeEngine';
import { FaceQualityEngine } from '../engines/FaceQualityEngine';
import { HeadPoseEngine } from '../engines/HeadPoseEngine';
import { TemporalFilterEngine } from '../engines/TemporalFilterEngine';
import { ViolationEngine } from '../engines/ViolationEngine';
import { EvidenceRecorder } from '../services/EvidenceRecorder';
import { mediaPipeFaceLandmarkerWorkerClient } from '../services/MediaPipeFaceLandmarkerWorkerClient';
import type {
  CameraStatus,
  EvidenceItem,
  MediaPipeStatus,
  ProctoringFrameAnalysis,
  ViolationEngineThresholds,
  ViolationEvent,
} from '../types/proctoring';
import { getMatrixData } from '../utils/landmarkGeometry';

const FRAME_INTERVAL_MS = 1000 / 30;
const UI_UPDATE_INTERVAL_MS = 120;

// BE (ProctoringSettings.violationTypeThresholds) đặt tên loại vi phạm khác FE nội bộ (khớp enum
// ViolationType của BE, xem AcademicRequestDtos.cs) — không có "Impersonation" ở đây vì
// ViolationEngine hiện KHÔNG detect loại này (impersonation là bài toán xác thực danh tính khác,
// không thuộc MediaPipe landmark analysis) — threshold đó trong settings hiện chưa có consumer.
const BE_TO_FE_THRESHOLD_KEY: Partial<Record<ProctoringViolationTypeThreshold['violationType'], keyof ViolationEngineThresholds>> = {
  Absence: 'absenceMs',
  MultipleFaces: 'multipleFaceMs',
  FaceObstructed: 'faceObstructedMs',
  HeadTurn: 'headTurnMs',
  GazeDiversion: 'eyeDiversionMs',
};

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
        // Path tương đối '/api/violation-logs' CHỈ hoạt động ở local dev nhờ proxy trong vite.config.ts
        // — trên Vercel (không có proxy đó) nó resolve về domain FE, không tới được BE thật, khiến
        // toàn bộ violation log không được ghi nhận khi thi trên bản deploy. Phải ghép API_BASE_URL.
        uploadUrl: import.meta.env.VITE_FASTAPI_EVIDENCE_URL ?? `${API_BASE_URL}/api/violation-logs`,
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
  // Chặn gửi frame mới vào worker khi frame trước còn đang detect — thay vì xếp hàng (queue) làm
  // hàng đợi phình to nếu worker chậm hơn tốc độ frame gửi lên, ta CHỦ ĐỘNG BỎ frame mới, chỉ xử
  // lý frame mới nhất mỗi lần rảnh (cùng nguyên tắc "drop stale frame" cho pipeline real-time).
  const detectionBusyRef = useRef(false);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);

    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Phần "nặng" (MediaPipe inference) giờ chạy trong Worker riêng (faceLandmarker.worker.ts),
  // KHÔNG còn block main thread mỗi tick rAF như trước (nguyên nhân chính gây giật hình khi máy
  // yếu) — hàm này chạy độc lập, không await trong processFrame, để rAF loop luôn được lên lịch
  // đúng nhịp bất kể worker phản hồi nhanh/chậm. `timestamp` truyền vào được CHỤP TẠI THỜI ĐIỂM
  // GỬI FRAME (không phải lúc worker trả lời), để ViolationEngine tính duration đúng theo thời
  // gian thực, không bị lệch bởi độ trễ round-trip qua worker.
  const detectAndEvaluate = useCallback(
    async (video: HTMLVideoElement, timestamp: number) => {
      try {
        const result = await mediaPipeFaceLandmarkerWorkerClient.detectForVideo(video, timestamp);
        if (!runningRef.current || !result) return;

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
      } catch (err) {
        console.warn('[useAiProctoring] Detection failed for this frame, skipping:', err);
      } finally {
        detectionBusyRef.current = false;
      }
    },
    [engines],
  );

  const processFrame = useCallback(
    (timestamp: number) => {
      if (!runningRef.current) return;

      const video = videoRef.current;
      if (!video) {
        stopLoop();
        return;
      }

      // Chụp frame evidence ngay đầu tick, TRƯỚC khi gửi frame đi detect — để việc chụp không bị
      // trễ thêm bởi độ trễ của worker (giờ đã tách thread, nhưng vẫn giữ đúng thứ tự cũ).
      engines.evidence.tick(timestamp);

      if (!detectionBusyRef.current && timestamp - lastFrameAtRef.current >= FRAME_INTERVAL_MS) {
        lastFrameAtRef.current = timestamp;
        detectionBusyRef.current = true;
        void detectAndEvaluate(video, timestamp);
      }

      rafIdRef.current = window.requestAnimationFrame(processFrame);
    },
    [detectAndEvaluate, engines.evidence, stopLoop, videoRef],
  );

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);

    // ── Camera ──
    try {
      setCameraStatus('requesting');
      await cameraService.start(video, {}, () => {
        // Camera tự tắt ngoài ý muốn (rút webcam, app khác chiếm quyền, OS thu hồi permission
        // giữa chừng...) — không phải do stop() chủ động gọi. Đưa cameraStatus về 'error' để UI
        // (CameraGateModal) chặn thi lại ngay, và dừng luôn vòng lặp detect vì video không còn
        // frame thật để phân tích nữa.
        setCameraStatus('error');
        stopLoop();
      });
      engines.evidence.start(video);
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
      await mediaPipeFaceLandmarkerWorkerClient.initialize();
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

  // Lấy cấu hình AI Proctoring thật (ngưỡng thời gian bắt vi phạm theo từng loại) từ BE, thay cho
  // DEFAULT_THRESHOLDS hard-code trong ViolationEngine — gọi 1 lần khi bắt đầu ca thi, TRƯỚC
  // start(), để vòng lặp detect dùng đúng ngưỡng ngay từ frame đầu tiên. Lỗi mạng/không có
  // institutionId thì giữ nguyên ngưỡng mặc định, không chặn thi.
  const applyProctoringSettings = useCallback(async (institutionId?: string | null) => {
    try {
      const settings = await fetchEffectiveProctoringSettings(institutionId);
      const mapped: Partial<ViolationEngineThresholds> = {};
      settings.violationTypeThresholds.forEach((entry) => {
        const key = BE_TO_FE_THRESHOLD_KEY[entry.violationType];
        if (key) mapped[key] = entry.detectionThresholdSeconds * 1000;
      });
      engines.violation.setThresholds(mapped);
    } catch (err) {
      console.warn('[useAiProctoring] Failed to load proctoring settings, keeping default thresholds:', err);
    }
  }, [engines.violation]);

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
    applyProctoringSettings,
  };
}
