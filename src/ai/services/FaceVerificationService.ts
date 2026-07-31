import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/models/face_landmarker.task';

// Key landmark indices cho face comparison — bao phủ rộng cấu trúc mặt (viền hàm/mặt, chân mày,
// viền mắt, mũi, miệng) thay vì chỉ 10 điểm rời rạc trước đây. Càng nhiều điểm phân bố đều càng khó
// bị 2 người khác nhau "trùng hình dạng" ngẫu nhiên qua phép chuẩn hoá đơn giản (dịch + scale đều).
const KEY_INDICES = [
  // Viền mặt / hàm (face oval)
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  // Chân mày
  70, 63, 105, 66, 107, 336, 296, 334, 293, 300,
  // Viền mắt
  33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380,
  // Mũi
  1, 2, 98, 327, 168, 197,
  // Miệng
  61, 291, 0, 17, 78, 308, 13, 14,
];

export interface LandmarkSet {
  landmarks: NormalizedLandmark[];
  width: number;
  height: number;
}

/**
 * Detect face landmarks từ một URL ảnh tĩnh (IMAGE mode). Kèm kích thước ảnh thật (px) vì
 * MediaPipe trả toạ độ normalized riêng theo width/height của ẢNH ĐÓ — ảnh đăng ký (tỉ lệ dọc,
 * vd 4:5) và khung camera live (4:3) có tỉ lệ khung hình khác nhau, nên nếu so sánh thẳng toạ độ
 * normalized [0-1] mà không quy về cùng đơn vị pixel thật, hình dạng mặt sẽ bị méo lệch giữa 2 bên
 * dù cùng 1 người — đây là nguyên nhân chính khiến điểm khớp thấp bất thường kể cả khi đúng người.
 * Trả null nếu không detect được mặt.
 */
export async function extractLandmarksFromImage(
  imageUrl: string,
): Promise<LandmarkSet | null> {
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
    const landmarks = result.faceLandmarks?.[0];
    if (!landmarks) return null;
    return { landmarks, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  } finally {
    landmarker?.close();
  }
}

/** Quy 1 điểm landmark normalized [0-1] về hệ toạ độ pixel thật, gốc ở đỉnh mũi, đã xoay cho
 * đường nối 2 mắt nằm ngang, và scale theo khoảng cách 2 mắt (inter-ocular distance). */
function normalizePoint(
  p: NormalizedLandmark,
  width: number,
  height: number,
  originPx: { x: number; y: number },
  cosA: number,
  sinA: number,
  iodPx: number,
): { x: number; y: number } {
  const dx = p.x * width - originPx.x;
  const dy = p.y * height - originPx.y;
  // Xoay ngược góc nghiêng đầu (-angle) để đường nối 2 mắt về nằm ngang
  const rx = dx * cosA + dy * sinA;
  const ry = -dx * sinA + dy * cosA;
  return { x: rx / iodPx, y: ry / iodPx };
}

/**
 * So sánh hai tập landmark mặt người, đã quy về pixel thật + bù góc nghiêng đầu + chuẩn hoá theo
 * khoảng cách 2 mắt, để loại nhiễu do tỉ lệ khung hình và góc quay đầu khác nhau giữa ảnh đăng ký
 * (tĩnh) và camera live. Trả về similarity score 0-1 (1 = cùng người).
 */
export function computeFaceSimilarity(
  ref: LandmarkSet,
  live: LandmarkSet,
): number {
  const r = ref.landmarks;
  const l = live.landmarks;
  if (!r.length || !l.length) return 0;

  const refEyeR = { x: r[33].x * ref.width, y: r[33].y * ref.height };
  const refEyeL = { x: r[263].x * ref.width, y: r[263].y * ref.height };
  const liveEyeR = { x: l[33].x * live.width, y: l[33].y * live.height };
  const liveEyeL = { x: l[263].x * live.width, y: l[263].y * live.height };

  const refIOD = Math.hypot(refEyeR.x - refEyeL.x, refEyeR.y - refEyeL.y);
  const liveIOD = Math.hypot(liveEyeR.x - liveEyeL.x, liveEyeR.y - liveEyeL.y);
  if (refIOD < 1 || liveIOD < 1) return 0;

  const refAngle = Math.atan2(refEyeL.y - refEyeR.y, refEyeL.x - refEyeR.x);
  const liveAngle = Math.atan2(liveEyeL.y - liveEyeR.y, liveEyeL.x - liveEyeR.x);
  const refCos = Math.cos(refAngle), refSin = Math.sin(refAngle);
  const liveCos = Math.cos(liveAngle), liveSin = Math.sin(liveAngle);

  const refOrigin = { x: r[1].x * ref.width, y: r[1].y * ref.height };
  const liveOrigin = { x: l[1].x * live.width, y: l[1].y * live.height };

  let totalDist = 0;
  let count = 0;
  for (const idx of KEY_INDICES) {
    if (!r[idx] || !l[idx]) continue;
    const rp = normalizePoint(r[idx], ref.width, ref.height, refOrigin, refCos, refSin, refIOD);
    const lp = normalizePoint(l[idx], live.width, live.height, liveOrigin, liveCos, liveSin, liveIOD);
    totalDist += Math.hypot(rp.x - lp.x, rp.y - lp.y);
    count++;
  }

  const avgDist = count > 0 ? totalDist / count : 999;
  return Math.max(0, Math.exp(-avgDist * 3.5));
}
