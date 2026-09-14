import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// FilesetResolver dùng import()/script-injection động để load file loader wasm
// (vision_wasm_internal.js) — nếu file đó nằm trong public/, Vite dev server chặn cứng việc
// import() (chỉ dev, không phải build/prod: "This file is in /public ... should not be imported
// from source code"). Dùng CDN chính thức của MediaPipe cho phần wasm (generic, không riêng cho
// model nào) để tránh hẳn — model face_landmarker.task vẫn tự host vì nó load qua fetch() bình
// thường, không bị lỗi này. Đã verify không có CSP nào (vercel.json/index.html) chặn CDN này.
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_PATH = '/mediapipe/models/face_landmarker.task';

export class MediaPipeFaceLandmarkerService {
  private static instance: MediaPipeFaceLandmarkerService | null = null;
  private landmarker: FaceLandmarker | null = null;
  private initialization: Promise<FaceLandmarker> | null = null;

  static getInstance() {
    if (!MediaPipeFaceLandmarkerService.instance) {
      MediaPipeFaceLandmarkerService.instance = new MediaPipeFaceLandmarkerService();
    }

    return MediaPipeFaceLandmarkerService.instance;
  }

  async initialize(): Promise<FaceLandmarker> {
    if (this.landmarker) return this.landmarker;
    if (this.initialization) return this.initialization;

    this.initialization = this.createLandmarker();
    this.landmarker = await this.initialization;

    return this.landmarker;
  }

  detectForVideo(video: HTMLVideoElement, timestampMs: number): FaceLandmarkerResult | null {
    if (!this.landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    return this.landmarker.detectForVideo(video, timestampMs);
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
    this.initialization = null;
  }

  private async createLandmarker() {
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
}

export const mediaPipeFaceLandmarkerService = MediaPipeFaceLandmarkerService.getInstance();
