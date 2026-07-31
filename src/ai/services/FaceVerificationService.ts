import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/models/face_landmarker.task';

// Key landmark indices cho face comparison (eyes, nose, mouth corners, chin, cheeks)
const KEY_INDICES = [1, 33, 61, 133, 152, 234, 263, 291, 362, 454];

/**
 * Detect face landmarks từ một URL ảnh tĩnh (IMAGE mode).
 * Trả null nếu không detect được mặt.
 */
export async function extractLandmarksFromImage(
  imageUrl: string,
): Promise<NormalizedLandmark[] | null> {
  let landmarker: FaceLandmarker | null = null;
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
      runningMode: 'IMAGE',
      numFaces: 1,
      minFaceDetectionConfidence: 0.45,
    });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });

    const result = landmarker.detect(img);
    return result.faceLandmarks?.[0] ?? null;
  } catch {
    return null;
  } finally {
    landmarker?.close();
  }
}

/**
 * So sánh hai tập landmark mặt người.
 * Normalize theo khoảng cách hai mắt (inter-ocular distance) và nose tip.
 * Trả về similarity score 0-1 (1 = cùng người).
 */
export function computeFaceSimilarity(
  ref: NormalizedLandmark[],
  live: NormalizedLandmark[],
): number {
  if (!ref.length || !live.length) return 0;

  const refIOD = Math.hypot(ref[33].x - ref[263].x, ref[33].y - ref[263].y);
  const liveIOD = Math.hypot(live[33].x - live[263].x, live[33].y - live[263].y);
  if (refIOD < 0.01 || liveIOD < 0.01) return 0;

  const rn = ref[1];   // nose tip reference
  const ln = live[1];  // nose tip live

  let totalDist = 0;
  let count = 0;
  for (const idx of KEY_INDICES) {
    if (!ref[idx] || !live[idx]) continue;
    const rx = (ref[idx].x - rn.x) / refIOD;
    const ry = (ref[idx].y - rn.y) / refIOD;
    const lx = (live[idx].x - ln.x) / liveIOD;
    const ly = (live[idx].y - ln.y) / liveIOD;
    totalDist += Math.hypot(rx - lx, ry - ly);
    count++;
  }

  const avgDist = count > 0 ? totalDist / count : 999;
  return Math.max(0, Math.exp(-avgDist * 2));
}
