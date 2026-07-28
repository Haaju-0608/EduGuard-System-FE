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

  /**
   * `onEnded` — báo khi track camera tự dừng NGOÀI Ý MUỐN (rút webcam, app khác chiếm quyền,
   * OS thu hồi permission giữa chừng...) — khác với `stop()` chủ động gọi từ code. Không có
   * listener này thì proctoring không biết camera đã chết, `cameraStatus` vẫn kẹt ở 'ready' dù
   * không còn frame nào thật để phân tích/quay bằng chứng nữa.
   */
  async start(video: HTMLVideoElement, constraints: CameraConstraints = {}, onEnded?: () => void): Promise<MediaStream> {
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

    if (onEnded) {
      this.stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', onEnded, { once: true });
      });
    }

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
