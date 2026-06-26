import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
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
