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
// Vi phạm CÙNG loại xảy ra trong khoảng này kể từ lần ghi hình gần nhất sẽ bị bỏ qua hoàn toàn
// (không compose video, không tạo violation log) — clip vừa ghi đã đủ làm bằng chứng, tránh CPU
// phải xử lý nhiều evidence gần như giống hệt nhau liên tiếp gây giật hình.
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
  private video: HTMLVideoElement | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;
  private captureContext: CanvasRenderingContext2D | null = null;
  private rollingFrames: EvidenceFrame[] = [];
  private postViolationFrames: EvidenceFrame[] = [];
  private activeViolations: EvidenceViolationMetadata[] = [];
  private pendingRequests: PendingEvidenceRequest[] = [];
  private lastCaptureAt = 0;
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

  start(video: HTMLVideoElement) {
    this.stop();

    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser.');
    }

    // Dùng chung <video> đang chạy detection (videoRef) thay vì tạo video ẩn riêng để decode lại
    // cùng 1 stream lần nữa — decode kép + setInterval độc lập với vòng lặp rAF của detection là
    // nguyên nhân chính gây đứng hình/giật: dưới tải nặng (MediaPipe chạy đồng bộ mỗi rAF tick),
    // browser có thể trì hoãn/gộp các lần gọi setInterval một cách không đều, đúng lúc violation
    // vừa bắt được lại càng dễ bị vì có thêm việc đồng bộ (setState, ghi log) chen vào cùng tick.
    this.video = video;
    this.mimeType = this.resolveMimeType();
    this.captureCanvas = document.createElement('canvas');
    this.captureContext = this.captureCanvas.getContext('2d', { alpha: false });
    this.isRunning = true;
    this.lastCaptureAt = 0;
  }

  // Gọi từ vòng lặp requestAnimationFrame của detection (cùng "đồng hồ" với việc phân tích
  // vi phạm) thay vì setInterval riêng, để việc chụp frame không bị timer khác cạnh tranh/trễ.
  tick(now: number) {
    if (!this.isRunning) return;
    if (now - this.lastCaptureAt < this.options.chunkMs) return;
    this.lastCaptureAt = now;
    void this.captureFrame();
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

      const clipFrames = this.buildFixedClipFrames(
        request.preViolationFrames,
        this.postViolationFrames,
        request.capturedAt,
      );
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
    this.lastCaptureAt = 0;

    // Video giờ là <video> dùng chung với detection (không còn sở hữu riêng) — không được
    // pause/clear srcObject của nó ở đây vì sẽ làm gãy preview camera + vòng lặp detection.
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
    // Decode từng bitmap RẢI RA theo tiến độ vẽ (thay vì Promise.all giải mã hết ~150 ảnh cùng lúc
    // lúc bắt đầu compose) — giải mã hàng loạt dồn vào 1 thời điểm sẽ dồn CPU đúng lúc vòng lặp
    // rAF detection + evidence.tick của violation KẾ TIẾP đang chạy, gây giật hình ở clip đó.
    let currentBitmap = await createImageBitmap(frames[0].blob);
    const canvas = document.createElement('canvas');
    canvas.width = currentBitmap.width;
    canvas.height = currentBitmap.height;
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) {
      currentBitmap.close();
      throw new Error('Unable to create canvas context for evidence video.');
    }

    const stream = canvas.captureStream(0);
    const [track] = stream.getVideoTracks();
    const manualTrack = track as CanvasCaptureMediaStreamTrack | undefined;
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

    for (let index = 0; index < frames.length; index += 1) {
      context.drawImage(currentBitmap, 0, 0, canvas.width, canvas.height);
      manualTrack?.requestFrame();
      currentBitmap.close();

      const nextFrame = frames[index + 1];
      const decodeNext = nextFrame ? createImageBitmap(nextFrame.blob) : null;

      const nextFrameAt = startedAt + (index + 1) * this.options.chunkMs;
      const delayMs = Math.max(0, nextFrameAt - performance.now());
      const [decoded] = await Promise.all([decodeNext, this.wait(delayMs)]);
      if (decoded) currentBitmap = decoded;
    }

    if (recorder.state !== 'inactive') {
      recorder.requestData();
      recorder.stop();
    }

    return stopped;
  }

  private buildFixedClipFrames(
    preViolationFrames: EvidenceFrame[],
    postViolationFrames: EvidenceFrame[],
    violationAt: number,
  ) {
    const preFrameCount = Math.ceil(DEFAULT_PRE_EVENT_MS / this.options.chunkMs);
    const postFrameCount = Math.ceil(this.options.postViolationMs / this.options.chunkMs);
    const targetCount = preFrameCount + postFrameCount;
    const frames = [...preViolationFrames, ...postViolationFrames]
      .filter((frame) => frame.blob.size > 0)
      .sort((a, b) => a.capturedAt - b.capturedAt);

    if (frames.length === 0) return [];

    // Chọn frame theo mốc thời gian THỰC (không theo tỉ lệ index) và neo đúng vào thời điểm
    // xảy ra vi phạm (violationAt). Tốc độ chụp frame thực tế không đều tuyệt đối 67ms/frame
    // (JPEG encode + isCapturingFrame guard có thể làm rớt frame), nên nếu resample theo tỉ lệ
    // index như trước sẽ làm ranh giới pre/post trôi khỏi thời điểm vi phạm thật, gây giật/nhảy
    // hình đúng ngay chỗ nối 5s.
    const totalDurationMs = DEFAULT_PRE_EVENT_MS + this.options.postViolationMs;
    const startAt = violationAt - DEFAULT_PRE_EVENT_MS;
    const stepMs = totalDurationMs / Math.max(1, targetCount - 1);

    let cursor = 0;
    return Array.from({ length: targetCount }, (_, index) => {
      const idealAt = startAt + index * stepMs;
      while (
        cursor < frames.length - 1
        && Math.abs(frames[cursor + 1].capturedAt - idealAt) <= Math.abs(frames[cursor].capturedAt - idealAt)
      ) {
        cursor += 1;
      }
      return frames[cursor];
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

    // DEBUG: Preview original frontend Blob before upload
    // Used to compare Blob output vs uploaded Supabase video.
    const objectUrl = URL.createObjectURL(videoBlob);

    if (!this.options.uploadUrl) {
      return {
        ...baseItem,
        videoObjectUrl: objectUrl,
      };
    }

    try {
      await this.upload(videoBlob, violation, violations, timestampIso, baseItem.durationMs);
      return {
        ...baseItem,
        videoObjectUrl: objectUrl,
        uploadStatus: 'uploaded',
      };
    } catch (error) {
      return {
        ...baseItem,
        videoObjectUrl: objectUrl,
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
