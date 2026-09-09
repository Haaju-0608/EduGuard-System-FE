import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// Wrapper main-thread cho faceLandmarker.worker.ts — giữ interface gần giống
// MediaPipeFaceLandmarkerService cũ (initialize/detectForVideo/close) để useAiProctoring.ts đổi
// sang dùng worker mà không phải viết lại toàn bộ pipeline downstream (headPose/eyeGaze/violation
// evaluate vẫn nhận đúng FaceLandmarkerResult như trước). Khác biệt duy nhất: detectForVideo giờ
// là async (phải postMessage sang worker rồi đợi trả lời) và nhận `ImageBitmap` thay vì
// `HTMLVideoElement` — main thread phải tự chụp bitmap trước (createImageBitmap(video)) vì Worker
// không có quyền truy cập DOM (<video> element không transfer được sang worker).
export class MediaPipeFaceLandmarkerWorkerClient {
  private static instance: MediaPipeFaceLandmarkerWorkerClient | null = null;
  private worker: Worker | null = null;
  private initialization: Promise<void> | null = null;
  private nextRequestId = 0;
  private pending = new Map<number, { resolve: (r: FaceLandmarkerResult | null) => void; reject: (e: Error) => void }>();

  static getInstance() {
    MediaPipeFaceLandmarkerWorkerClient.instance ??= new MediaPipeFaceLandmarkerWorkerClient();
    return MediaPipeFaceLandmarkerWorkerClient.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialization) return this.initialization;

    this.initialization = new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./faceLandmarker.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;

        if (msg.type === 'ready') {
          resolve();
          return;
        }
        if (msg.type === 'init-error') {
          reject(new Error(msg.message));
          return;
        }
        if (msg.type === 'result') {
          this.pending.get(msg.requestId)?.resolve(msg.result);
          this.pending.delete(msg.requestId);
          return;
        }
        if (msg.type === 'detect-error') {
          this.pending.get(msg.requestId)?.reject(new Error(msg.message));
          this.pending.delete(msg.requestId);
        }
      };

      worker.onerror = (event) => {
        reject(new Error(event.message || 'FaceLandmarker worker failed to start.'));
      };

      worker.postMessage({ type: 'init' });
    });

    return this.initialization;
  }

  /**
   * Chụp 1 ImageBitmap từ <video> (main thread, native/hardware-accelerated, KHÔNG chạy MediaPipe)
   * rồi transfer sang worker để detect — bitmap là transferable nên gần như zero-copy, không đúc
   * lại pixel data qua postMessage. Trả về null nếu video chưa có frame hoặc worker chưa sẵn sàng
   * (giữ đúng hành vi cũ của detectForVideo khi video.readyState chưa đủ).
   */
  async detectForVideo(video: HTMLVideoElement, timestampMs: number): Promise<FaceLandmarkerResult | null> {
    if (!this.worker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const bitmap = await createImageBitmap(video);
    const requestId = this.nextRequestId++;

    return new Promise<FaceLandmarkerResult | null>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker!.postMessage({ type: 'detect', requestId, bitmap, timestampMs }, [bitmap]);
    });
  }

  close() {
    this.worker?.postMessage({ type: 'dispose' });
    this.worker?.terminate();
    this.worker = null;
    this.initialization = null;
    this.pending.forEach(({ reject }) => reject(new Error('FaceLandmarker worker closed.')));
    this.pending.clear();
  }
}

export const mediaPipeFaceLandmarkerWorkerClient = MediaPipeFaceLandmarkerWorkerClient.getInstance();
