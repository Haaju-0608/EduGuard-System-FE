import type { EvidenceItem, EvidenceViolationMetadata, ViolationType, ViolationEvent } from '../types/proctoring';
import { getAccessToken } from '../../services/authStorage';

// Map FE violation types → BE enum values (AcademicRequestDtos.cs ViolationType)
// BE only has: Impersonation | GazeDiversion | MultipleFaces | Absence
const VIOLATION_TYPE_MAP: Record<ViolationType, string> = {
  EYE_DIVERSION:   'GazeDiversion',
  HEAD_TURN:       'GazeDiversion',   // BE chưa có HeadTurn riêng
  ABSENCE:         'Absence',
  MULTIPLE_FACE:   'MultipleFaces',
  FACE_OBSTRUCTED: 'Absence',         // BE chưa có FaceObstructed riêng
};

const DEFAULT_PRE_EVENT_MS = 5000;
const DEFAULT_FRAME_INTERVAL_MS = 67;
const DEFAULT_POST_VIOLATION_MS = 5000;
const DEFAULT_VIDEO_BITS_PER_SECOND = 2_600_000;
const DEFAULT_CAPTURE_WIDTH = 960;
const DEFAULT_JPEG_QUALITY = 0.84;
const DEFAULT_PARTICIPATION_ID = 'local-ai-prototype';
const DEFAULT_SESSION_ID = 'local-session';
const DEFAULT_STUDENT_ID = 'local-student';

interface EvidenceRecorderOptions {
  uploadUrl?: string;
  participationId?: string;
  sessionId?: string;
  studentId?: string;
  maxChunks?: number;
  chunkMs?: number;
  postViolationMs?: number;
  videoBitsPerSecond?: number;
}

interface EvidenceFrame {
  blob: Blob;
  capturedAt: number;
}

interface EvidenceRequest {
  violation: ViolationEvent;
  violationMetadata: EvidenceViolationMetadata;
  preViolationFrames: EvidenceFrame[];
  capturedAt: number;
  timestampIso: string;
}

interface PendingEvidenceRequest extends EvidenceRequest {
  resolve: (item: EvidenceItem | null) => void;
}

export class EvidenceRecorder {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;
  private captureContext: CanvasRenderingContext2D | null = null;
  private rollingFrames: EvidenceFrame[] = [];
  private postViolationFrames: EvidenceFrame[] = [];
  private activeViolations: EvidenceViolationMetadata[] = [];
  private pendingRequests: PendingEvidenceRequest[] = [];
  private captureTimer = 0;
  private mimeType = '';
  private isRunning = false;
  private isCapturingFrame = false;
  private isRecordingEvidence = false;
  private isCollectingEvidence = false;
  private options: Required<Omit<EvidenceRecorderOptions, 'uploadUrl'>> & Pick<EvidenceRecorderOptions, 'uploadUrl'>;

  constructor(options: EvidenceRecorderOptions = {}) {
    this.options = {
      uploadUrl: options.uploadUrl,
      participationId: options.participationId ?? DEFAULT_PARTICIPATION_ID,
      sessionId: options.sessionId ?? DEFAULT_SESSION_ID,
      studentId: options.studentId ?? DEFAULT_STUDENT_ID,
      maxChunks: options.maxChunks ?? Math.ceil(DEFAULT_PRE_EVENT_MS / DEFAULT_FRAME_INTERVAL_MS),
      chunkMs: options.chunkMs ?? DEFAULT_FRAME_INTERVAL_MS,
      postViolationMs: options.postViolationMs ?? DEFAULT_POST_VIOLATION_MS,
      videoBitsPerSecond: options.videoBitsPerSecond ?? DEFAULT_VIDEO_BITS_PER_SECOND,
    };
  }

  start(stream: MediaStream) {
    this.stop();

    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser.');
    }

    this.stream = stream;
    this.mimeType = this.resolveMimeType();
    this.video = document.createElement('video');
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.play().catch(() => undefined);
    this.captureCanvas = document.createElement('canvas');
    this.captureContext = this.captureCanvas.getContext('2d', { alpha: false });
    this.isRunning = true;
    this.captureTimer = window.setInterval(() => {
      void this.captureFrame();
    }, this.options.chunkMs);
  }

  async recordEvidence(violation: ViolationEvent): Promise<EvidenceItem | null> {
    if (!this.isRunning) {
      return null;
    }

    const violationMetadata = this.toViolationMetadata(violation);
    if (this.isRecordingEvidence) {
      if (this.isCollectingEvidence) {
        this.appendActiveViolation(violationMetadata);
        return null;
      }

      return new Promise((resolve) => {
        this.pendingRequests.push({
          violation,
          violationMetadata,
          preViolationFrames: this.rollingFrames.slice(),
          capturedAt: Date.now(),
          timestampIso: new Date().toISOString(),
          resolve,
        });
      });
    }

    const capturedAt = Date.now();
    const request: EvidenceRequest = {
      violation,
      violationMetadata,
      preViolationFrames: this.rollingFrames.slice(),
      capturedAt,
      timestampIso: new Date(capturedAt).toISOString(),
    };

    return this.captureEvidence(request);
  }

  private async captureEvidence(request: EvidenceRequest): Promise<EvidenceItem | null> {
    this.isRecordingEvidence = true;
    this.isCollectingEvidence = true;
    this.activeViolations = [request.violationMetadata];
    this.postViolationFrames = [];

    try {
      await this.wait(this.options.postViolationMs);

      const clipFrames = this.buildFixedClipFrames(request.preViolationFrames, this.postViolationFrames);
      const violations = [...this.activeViolations];
      const durationMs = DEFAULT_PRE_EVENT_MS + this.options.postViolationMs;

      // Đã chốt xong frame + gộp violation — violation mới tới từ giờ sẽ được xếp hàng (pendingRequests)
      // thay vì merge vào clip này. Nhưng CHƯA mở khóa cho violation kế tiếp compose/upload ngay
      // (isRecordingEvidence vẫn giữ true tới hết finally) để tránh 2 vòng lặp canh giờ frame + upload
      // mạng chạy chồng lên nhau trên cùng 1 luồng JS, gây giật video khi ghép canvas.
      request.preViolationFrames.length = 0;
      this.postViolationFrames = [];
      this.activeViolations = [];
      this.isCollectingEvidence = false;

      if (clipFrames.length === 0) return null;

      const videoBlob = await this.composeVideoBlob(clipFrames);

      return await this.createEvidenceItem(
        videoBlob,
        request.violation,
        violations,
        request.capturedAt,
        request.timestampIso,
        durationMs,
      );
    } finally {
      this.isRecordingEvidence = false;
      this.processNextPendingRequest();
    }
  }

  updateConfig(opts: { participationId?: string; studentId?: string; sessionId?: string }) {
    if (opts.participationId) this.options.participationId = opts.participationId;
    if (opts.studentId) this.options.studentId = opts.studentId;
    if (opts.sessionId) this.options.sessionId = opts.sessionId;
  }

  stop() {
    this.isRunning = false;
    window.clearInterval(this.captureTimer);
    this.captureTimer = 0;

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }

    this.stream = null;
    this.video = null;
    this.captureCanvas = null;
    this.captureContext = null;
    this.mimeType = '';
    this.rollingFrames = [];
    this.postViolationFrames = [];
    this.activeViolations = [];
    this.pendingRequests.forEach((request) => request.resolve(null));
    this.pendingRequests = [];
    this.isCapturingFrame = false;
    this.isCollectingEvidence = false;
    this.isRecordingEvidence = false;
  }

  releaseEvidence(items: EvidenceItem[]) {
    items.forEach((item) => {
      if (item.videoObjectUrl) {
        URL.revokeObjectURL(item.videoObjectUrl);
      }
    });
  }

  private async captureFrame() {
    if (this.isCapturingFrame) return;
    if (!this.isRunning || !this.video || !this.captureCanvas || !this.captureContext) return;
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !this.video.videoWidth || !this.video.videoHeight) return;

    this.isCapturingFrame = true;
    try {
      const width = Math.min(DEFAULT_CAPTURE_WIDTH, this.video.videoWidth);
      const scale = width / this.video.videoWidth;
      const height = Math.round(this.video.videoHeight * scale);
      this.captureCanvas.width = width;
      this.captureCanvas.height = height;
      this.captureContext.drawImage(this.video, 0, 0, width, height);

      const blob = await this.canvasToBlob(this.captureCanvas);
      if (!blob.size) return;

      const frame = {
        blob,
        capturedAt: Date.now(),
      };

      this.rollingFrames.push(frame);
      while (this.rollingFrames.length > this.options.maxChunks) {
        this.rollingFrames.shift();
      }

      if (this.isCollectingEvidence) {
        this.postViolationFrames.push(frame);
      }
    } finally {
      this.isCapturingFrame = false;
    }
  }

  private canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? new Blob()), 'image/jpeg', DEFAULT_JPEG_QUALITY);
    });
  }

  private async composeVideoBlob(frames: EvidenceFrame[]) {
    const bitmaps = await Promise.all(frames.map((frame) => createImageBitmap(frame.blob)));
    const firstBitmap = bitmaps[0];
    const canvas = document.createElement('canvas');
    canvas.width = firstBitmap.width;
    canvas.height = firstBitmap.height;
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) {
      bitmaps.forEach((bitmap) => bitmap.close());
      throw new Error('Unable to create canvas context for evidence video.');
    }

    const stream = canvas.captureStream(Math.round(1000 / this.options.chunkMs));
    const recorder = new MediaRecorder(stream, {
      ...(this.mimeType ? { mimeType: this.mimeType } : {}),
      videoBitsPerSecond: this.options.videoBitsPerSecond,
    });
    const videoChunks: Blob[] = [];
    const stopped = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        // BE whitelist content-type theo chuỗi tuyệt đối ("video/webm"/"video/mp4"),
        // không chấp nhận tham số codec (vd "video/webm;codecs=vp9") → phải bỏ phần sau dấu ";"
        const rawType = recorder.mimeType || this.mimeType || 'video/webm';
        const baseType = rawType.split(';')[0].trim();
        resolve(new Blob(videoChunks, { type: baseType }));
      };
    });

    recorder.start();
    const startedAt = performance.now();

    for (const [index, bitmap] of bitmaps.entries()) {
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const nextFrameAt = startedAt + (index + 1) * this.options.chunkMs;
      const delayMs = Math.max(0, nextFrameAt - performance.now());
      if (delayMs > 0) {
        await this.wait(delayMs);
      }
    }

    bitmaps.forEach((bitmap) => bitmap.close());

    if (recorder.state !== 'inactive') {
      recorder.requestData();
      recorder.stop();
    }

    return stopped;
  }

  private buildFixedClipFrames(preViolationFrames: EvidenceFrame[], postViolationFrames: EvidenceFrame[]) {
    const preFrameCount = Math.ceil(DEFAULT_PRE_EVENT_MS / this.options.chunkMs);
    const postFrameCount = Math.ceil(this.options.postViolationMs / this.options.chunkMs);
    const preFrames = this.normalizeFrameCount(preViolationFrames.slice(-preFrameCount), preFrameCount);
    const postFrames = this.normalizeFrameCount(postViolationFrames.slice(0, postFrameCount), postFrameCount);
    const fallbackFrame = preFrames[0] ?? postFrames[0];

    if (!fallbackFrame) return [];

    return [...preFrames, ...postFrames];
  }

  private normalizeFrameCount(frames: EvidenceFrame[], targetCount: number) {
    if (frames.length === 0) return [];
    if (frames.length === targetCount) return frames;

    if (frames.length > targetCount) {
      return Array.from({ length: targetCount }, (_, index) => {
        const sourceIndex = Math.round(index * (frames.length - 1) / Math.max(1, targetCount - 1));
        return frames[sourceIndex];
      });
    }

    return Array.from({ length: targetCount }, (_, index) => {
      const sourceIndex = Math.round(index * (frames.length - 1) / Math.max(1, targetCount - 1));
      return frames[sourceIndex];
    });
  }

  private async createEvidenceItem(
    videoBlob: Blob,
    violation: ViolationEvent,
    violations: EvidenceViolationMetadata[],
    capturedAt: number,
    timestampIso: string,
    durationMs: number,
  ): Promise<EvidenceItem> {
    const baseItem: EvidenceItem = {
      filename: `${violation.type}-${capturedAt}.webm`,
      id: `evidence-${violation.id}`,
      violationId: violation.id,
      violationType: violation.type,
      violations,
      capturedAt,
      videoSizeBytes: videoBlob.size,
      durationMs,
      uploadStatus: this.options.uploadUrl ? 'pending' : 'local',
    };

    if (!this.options.uploadUrl) {
      return {
        ...baseItem,
        videoObjectUrl: URL.createObjectURL(videoBlob),
      };
    }

    try {
      await this.upload(videoBlob, violation, violations, timestampIso, baseItem.durationMs);
      return {
        ...baseItem,
        uploadStatus: 'uploaded',
      };
    } catch (error) {
      return {
        ...baseItem,
        videoObjectUrl: URL.createObjectURL(videoBlob),
        uploadStatus: 'failed',
        uploadError: error instanceof Error ? error.message : 'Video upload failed.',
      };
    }
  }

  private async upload(
    videoBlob: Blob,
    violation: ViolationEvent,
    _violations: EvidenceViolationMetadata[],
    timestampIso: string,
    _durationMs: number,
  ) {
    if (!this.options.uploadUrl) return;

    const token = getAccessToken();
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Step 1: Tạo violation log (evidencePath: null), lấy violationId
    const logResponse = await fetch(this.options.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        participationId: this.options.participationId,
        severity: violation.severity === 'critical' ? 'Severe' : 'Warning',
        violationType: VIOLATION_TYPE_MAP[violation.type] ?? violation.type,
        evidencePath: null,
        aiConfidence: violation.metadata.signalConfidence ?? 0,
        reviewedBy: null,
        recordedAt: timestampIso,
      }),
    });

    if (!logResponse.ok) {
      throw new Error(`Create violation log failed with status ${logResponse.status}.`);
    }

    const logData = (await logResponse.json()) as { id?: string; data?: { id?: string } };
    const violationId = logData.id ?? logData.data?.id;

    if (!violationId) return; // Log tạo thành công nhưng không có ID để upload video

    // Step 2: Upload video lên Supabase qua BE
    const formData = new FormData();
    formData.append('file', videoBlob, `evidence-${violationId}.webm`);
    formData.append('violationId', violationId);

    const storageResponse = await fetch('/api/storage/evidence', {
      method: 'POST',
      headers: authHeader,
      body: formData,
    });

    if (!storageResponse.ok) {
      // Upload video thất bại nhưng violation log đã được tạo → không throw để tránh mất log
      console.warn(`[EvidenceRecorder] Video upload failed (${storageResponse.status}). Violation log ${violationId} was created without evidence.`);
    }
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  private appendActiveViolation(violation: EvidenceViolationMetadata) {
    const hasSameType = this.activeViolations.some((active) => active.violationType === violation.violationType);
    if (hasSameType) return;

    const isHeadEyePair = (
      (violation.violationType === 'HEAD_TURN' && this.activeViolations.some((active) => active.violationType === 'EYE_DIVERSION'))
      || (violation.violationType === 'EYE_DIVERSION' && this.activeViolations.some((active) => active.violationType === 'HEAD_TURN'))
    );
    if (isHeadEyePair) return;

    this.activeViolations.push(violation);
  }

  private processNextPendingRequest() {
    if (!this.isRunning || this.isRecordingEvidence) return;

    const request = this.pendingRequests.shift();
    if (!request) return;

    this.captureEvidence(request).then(request.resolve);
  }

  private resolveMimeType() {
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
  }

  private toViolationMetadata(violation: ViolationEvent): EvidenceViolationMetadata {
    return {
      violationId: violation.id,
      violationType: violation.type,
      timestamp: Date.now(),
      direction: violation.metadata.gaze,
      confidence: violation.metadata.signalConfidence,
      durationMs: violation.durationMs,
      faceCount: violation.metadata.faceCount,
      calibrationReady: true,
    };
  }
}
