export interface CameraConstraints {
  width?: number;
  height?: number;
  frameRate?: number;
  facingMode?: VideoFacingModeEnum;
}

const DEFAULT_CONSTRAINTS: Required<CameraConstraints> = {
  width: 1280,
  height: 720,
  frameRate: 30,
  facingMode: 'user',
};

export class CameraService {
  private static instance: CameraService | null = null;
  private stream: MediaStream | null = null;

  static getInstance() {
    if (!CameraService.instance) {
      CameraService.instance = new CameraService();
    }

    return CameraService.instance;
  }

  async start(video: HTMLVideoElement, constraints: CameraConstraints = {}): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not supported in this browser.');
    }

    this.stop();

    const merged = { ...DEFAULT_CONSTRAINTS, ...constraints };
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: merged.width },
        height: { ideal: merged.height },
        frameRate: { ideal: merged.frameRate, max: merged.frameRate },
        facingMode: merged.facingMode,
      },
      audio: false,
    });

    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;

    await video.play();

    return this.stream;
  }

  stop() {
    if (!this.stream) return;

    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  getStream() {
    return this.stream;
  }
}

export const cameraService = CameraService.getInstance();
