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
import { mediaPipeFaceLandmarkerService } from '../services/MediaPipeFaceLandmarkerService';
import type {
  CameraStatus,
  EvidenceItem,
  MediaPipeStatus,
  ProctoringFrameAnalysis,
  ViolationEngineThresholds,
  ViolationEvent,
} from '../types/proctoring';
import { getMatrixData } from '../utils/landmarkGeometry';

// Giảm từ 30fps xuống 20fps để giảm tải CPU chính (MediaPipe chạy đồng bộ trên main thread, xem
// ghi chú ở processFrame) — an toàn vì ViolationEngine tính ngưỡng theo THỜI GIAN (ms) chứ không
// theo số frame, 20fps vẫn đủ dày để bắt đúng vi phạm kéo dài >= 1 giây.
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
  // Lộ ra ngưỡng ĐANG THỰC SỰ chạy trong ViolationEngine + nguồn của nó — trước đây không cách
  // nào biết từ ngoài liệu applyProctoringSettings() có fetch thành công hay đang âm thầm rơi về
  // DEFAULT_THRESHOLDS (chỉ console.warn, không có state nào phản ánh) — dùng để debug khi báo
  // "không còn bắt được violation" sau khi đổi settings (xem ProctoringTestPage.tsx).
  const [thresholdsSource, setThresholdsSource] = useState<'default' | 'server' | 'error'>('default');
  const [activeThresholds, setActiveThresholds] = useState<ViolationEngineThresholds | null>(null);

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

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);

    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // ĐÃ THỬ chuyển MediaPipe sang Web Worker riêng (faceLandmarker.worker.ts) để hết giật hình do
  // chạy đồng bộ trên main thread — nhưng @mediapipe/tasks-vision không chạy được trong module
  // worker: loader nội bộ của nó chỉ biết dùng `importScripts()` (worker cổ điển) hoặc
  // `document.createElement('script')` (main thread), cả 2 đều không tồn tại trong module worker
  // (bắt buộc phải "type: module" vì cần cú pháp `import`) → lỗi "ModuleFactory not set." Package
  // cũng không có bản UMD/global để importScripts() trong worker cổ điển thay thế. Đây là giới
  // hạn thật của thư viện, không phải lỗi cấu hình — đã revert về chạy đồng bộ main thread như
  // trước (đã chứng minh chạy được ở production).
  //
  // TRƯỚC ĐÂY: khi EvidenceRecorder đang bận (isBusy — ghi hình + upload + cooldown), việc detect
  // MediaPipe bị TẠM DỪNG HẲN — cần thiết lúc đó vì EvidenceRecorder tự ghép video từ ảnh JPEG chụp
  // rời rạc (canvas.captureStream(0) + tự bơm frame bằng tay), một vòng lặp CHẠY TRÊN JS main
  // thread nên bị tranh CPU với MediaPipe là hỏng ngay (video dài gấp đôi, đứng hình...).
  //
  // GIỜ: EvidenceRecorder ghi TRỰC TIẾP từ MediaStream camera bằng MediaRecorder (xem
  // EvidenceRecorder.ts) — việc mã hoá do trình duyệt tự lo ở tầng native, KHÔNG cần JS main
  // thread rảnh để chạy đúng nhịp (khác hẳn cách ghép JPEG cũ) — nên không còn lý do phải tạm dừng
  // MediaPipe nữa. Bỏ việc pause để giảm "vùng mù" (trước đây ~9-13s sau mỗi vi phạm KHÔNG detect
  // được gì cả) — MediaPipe giờ chạy liên tục kể cả lúc EvidenceRecorder đang bận; vi phạm mới phát
  // hiện được trong lúc đó vẫn hiện trong `violations` (để minh bạch) nhưng KHÔNG được ghi
  // log/video mới (EvidenceRecorder.recordEvidence() tự bỏ qua qua chính `busy` flag của nó) — 2
  // clip evidence vẫn KHÔNG BAO GIỜ chồng lấn/lẫn frame vào nhau vì lý do đó, không phải vì
  // MediaPipe từng bị dừng.
  const processFrame = useCallback(
    (timestamp: number) => {
      if (!runningRef.current) return;

      const video = videoRef.current;
      if (!video) {
        stopLoop();
        return;
      }

      // Giữ lại cho tương thích ngược với EvidenceRecorderSnapshotLegacy.ts (bản dự phòng dùng
      // cách ghép JPEG cũ, cần tick() để chụp frame rolling buffer) — bản MediaRecorder hiện tại
      // không dùng gì tới hàm này (no-op), gọi vô hại.
      engines.evidence.tick(timestamp);

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
              // recordEvidence() báo violation log NGAY (tách rời khỏi việc quay video) — onUpdate
              // được gọi NHIỀU LẦN cho cùng 1 `item.id`: lần đầu 'pending' (log đã tạo, chưa có
              // video) để UI/BE hiện thông báo tức thì, lần sau 'uploaded'/'failed' khi video xử lý
              // xong. Match theo `id` để UPDATE đúng item thay vì thêm dòng mới mỗi lần.
              void engines.evidence.recordEvidence(event, (item) => {
                setEvidence((current) => {
                  const idx = current.findIndex((existing) => existing.id === item.id);
                  if (idx === -1) return [item, ...current].slice(0, 20);

                  const previous = current[idx];
                  if (previous.videoObjectUrl && previous.videoObjectUrl !== item.videoObjectUrl) {
                    engines.evidence.releaseEvidence([previous]);
                  }
                  const next = [...current];
                  next[idx] = item;
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
      setThresholdsSource('server');
      setActiveThresholds(engines.violation.getThresholds());
    } catch (err) {
      console.warn('[useAiProctoring] Failed to load proctoring settings, keeping default thresholds:', err);
      setThresholdsSource('error');
      setActiveThresholds(engines.violation.getThresholds());
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

  // Hiện ngay ngưỡng mặc định trước khi applyProctoringSettings() được gọi (hoặc nếu không bao
  // giờ được gọi) — không để activeThresholds là null ngay từ đầu.
  useEffect(() => {
    setActiveThresholds(engines.violation.getThresholds());
  }, [engines.violation]);

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
    thresholdsSource,
    activeThresholds,
    start,
    stop,
    clearLocalEvidence,
    updateProctoringConfig,
    applyProctoringSettings,
  };
}
