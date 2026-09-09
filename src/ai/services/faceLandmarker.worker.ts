/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// Chạy MediaPipe FaceLandmarker trong Worker riêng (thread khác main thread) — trước đây
// detectForVideo() chạy đồng bộ ngay trong callback requestAnimationFrame của main thread mỗi
// tick (~33ms ở 30fps), tranh CPU trực tiếp với việc render UI/video → đây là nguyên nhân chính
// gây giật hình khi máy học sinh không đủ mạnh. Model AI + wasm nặng nhất (FaceLandmarker) giờ
// chạy hoàn toàn ở đây, main thread chỉ còn việc nhẹ: chụp ImageBitmap + gửi qua postMessage.
//
// FaceLandmarkerResult chỉ gồm number/string/array thuần (không có ArrayBuffer/typed array nào
// — xem Matrix.data: number[] trong tasks-vision types) nên postMessage trả thẳng object gốc,
// không cần custom serialize.

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/models/face_landmarker.task';

let landmarker: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker> | null = null;

type WorkerRequest =
  | { type: 'init' }
  | { type: 'detect'; requestId: number; bitmap: ImageBitmap; timestampMs: number }
  | { type: 'dispose' };

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'result'; requestId: number; result: FaceLandmarkerResult | null }
  | { type: 'detect-error'; requestId: number; message: string };

async function createLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numFaces: 4,
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'init') {
    try {
      initPromise ??= createLandmarker();
      landmarker = await initPromise;
      (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage({ type: 'ready' });
    } catch (err) {
      (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage({
        type: 'init-error',
        message: err instanceof Error ? err.message : 'Failed to initialize FaceLandmarker in worker.',
      });
    }
    return;
  }

  if (msg.type === 'detect') {
    const { requestId, bitmap, timestampMs } = msg;
    try {
      const result = landmarker ? landmarker.detectForVideo(bitmap, timestampMs) : null;
      (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage({ type: 'result', requestId, result });
    } catch (err) {
      (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage({
        type: 'detect-error',
        requestId,
        message: err instanceof Error ? err.message : 'detectForVideo failed in worker.',
      });
    } finally {
      // ImageBitmap được transfer sang worker (zero-copy) — phải tự close() để giải phóng, main
      // thread không còn quyền truy cập nó nữa sau khi transfer.
      bitmap.close();
    }
    return;
  }

  if (msg.type === 'dispose') {
    landmarker?.close();
    landmarker = null;
    initPromise = null;
  }
};
