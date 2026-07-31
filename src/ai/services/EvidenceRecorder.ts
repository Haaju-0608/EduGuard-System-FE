import type { EvidenceItem, EvidenceViolationMetadata, ViolationType, ViolationEvent } from '../types/proctoring';
import { API_BASE_URL } from '../../services/apiClient';
import { getAccessToken } from '../../services/authStorage';
import { patchWebmDuration } from './webmDurationFix';

// Map FE violation types → BE enum values (AcademicRequestDtos.cs ViolationType)
// BE có đủ: Impersonation | GazeDiversion | MultipleFaces | Absence | HeadTurn | FaceObstructed
const VIOLATION_TYPE_MAP: Record<ViolationType, string> = {
  EYE_DIVERSION:   'GazeDiversion',
  HEAD_TURN:       'HeadTurn',
  ABSENCE:         'Absence',
  MULTIPLE_FACE:   'MultipleFaces',
  FACE_OBSTRUCTED: 'FaceObstructed',
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

// Một "cửa sổ" thu bằng chứng: bắt đầu ngay khi vi phạm xảy ra (startedAt = thời điểm THẬT),
// độc lập với việc clip trước đó có đang compose/upload hay chưa. Nhờ vậy postFrames luôn chứa
// đúng các frame thật sự được chụp trong khoảng [startedAt, startedAt+postViolationMs], không bị
// lệch/rỗng khi phải xếp hàng chờ việc nặng (dựng video, upload mạng) của vi phạm trước.
interface CollectionWindow {
  startedAt: number;
  preViolationFrames: EvidenceFrame[];
  postFrames: EvidenceFrame[];
  violations: EvidenceViolationMetadata[];
  primaryViolation: ViolationEvent;
  timestampIso: string;
}

export class EvidenceRecorder {
  private video: HTMLVideoElement | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;
  private captureContext: CanvasRenderingContext2D | null = null;
  private rollingFrames: EvidenceFrame[] = [];
  private activeWindow: CollectionWindow | null = null;
  // Hàng đợi TUẦN TỰ chỉ dành cho phần việc nặng (dựng canvas → video + upload mạng), để 2 clip
  // không tranh nhau 1 luồng JS. KHÔNG dùng để trì hoãn việc thu frame — đó là lý do "đứng hình".
  private composeChain: Promise<void> = Promise.resolve();
  private lastCaptureAt = 0;
  private mimeType = '';
  private isRunning = false;
  private isCapturingFrame = false;
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
    const now = Date.now();

    if (this.activeWindow && now - this.activeWindow.startedAt < this.options.postViolationMs) {
      // Vi phạm tới trong lúc cửa sổ thu hiện tại còn đang mở → gộp vào cùng 1 clip, không mở
      // cửa sổ mới (tránh nhiều clip gần như trùng nhau).
      this.appendActiveViolation(this.activeWindow, violationMetadata);
      return null;
    }

    const collectionWindow: CollectionWindow = {
      startedAt: now,
      preViolationFrames: this.rollingFrames.slice(),
      postFrames: [],
      violations: [violationMetadata],
      primaryViolation: violation,
      timestampIso: new Date(now).toISOString(),
    };
    this.activeWindow = collectionWindow;

    // Đợi đúng thời gian thực postViolationMs kể từ THỜI ĐIỂM VI PHẠM THẬT — không phụ thuộc
    // recorder có đang bận compose/upload clip trước hay không, nên postFrames luôn đúng thời gian.
    await this.wait(this.options.postViolationMs);

    if (!this.isRunning) return null;
    if (this.activeWindow === collectionWindow) {
      this.activeWindow = null;
    }

    const clipFrames = this.buildFixedClipFrames(
      collectionWindow.preViolationFrames,
      collectionWindow.postFrames,
      collectionWindow.startedAt,
    );
    if (clipFrames.length === 0) return null;

    const durationMs = DEFAULT_PRE_EVENT_MS + this.options.postViolationMs;

    // Phần nặng (vẽ canvas → video + upload mạng) chạy TUẦN TỰ qua composeChain để 2 clip không
    // tranh nhau 1 luồng JS, nhưng dữ liệu frame đã chốt xong đúng thời gian thực ở trên rồi nên
    // việc xếp hàng ở bước này không còn làm lệch/mất frame như trước nữa.
    return this.enqueueCompose(() => this.composeAndUpload(
      clipFrames,
      collectionWindow.primaryViolation,
      collectionWindow.violations,
      collectionWindow.startedAt,
      collectionWindow.timestampIso,
      durationMs,
    ));
  }

  private enqueueCompose<T>(task: () => Promise<T>): Promise<T> {
    const run = this.composeChain.then(task, task);
    this.composeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async composeAndUpload(
    clipFrames: EvidenceFrame[],
    violation: ViolationEvent,
    violations: EvidenceViolationMetadata[],
    capturedAt: number,
    timestampIso: string,
    durationMs: number,
  ): Promise<EvidenceItem | null> {
    if (!this.isRunning) return null;

    const videoBlob = await this.composeVideoBlob(clipFrames);

    return this.createEvidenceItem(videoBlob, violation, violations, capturedAt, timestampIso, durationMs);
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
    this.activeWindow = null;
    this.composeChain = Promise.resolve();
    this.isCapturingFrame = false;
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

      if (this.activeWindow) {
        this.activeWindow.postFrames.push(frame);
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
    // Decode từng bitmap RẢI RA theo tiến độ vẽ, luôn decode TRƯỚC 1 frame (prefetch) rồi mới chờ
    // đủ nhịp chunkMs — KHÔNG được gộp chờ-decode và chờ-nhịp lại với nhau (Promise.all cả hai),
    // vì nếu decode chẳng may chậm hơn nhịp thì thời gian đó sẽ CỘNG DỒN vào tổng thời lượng clip
    // (150 frame cộng dồn vài chục ms/frame là ra dư vài giây, đây là lý do clip từng bị dài 13s).
    // Prefetch cho decode chạy song song với thời gian chờ nhịp, không cộng dồn vào lịch phát.
    let currentBitmap = await createImageBitmap(frames[0].blob);
    let nextBitmapPromise = frames[1] ? createImageBitmap(frames[1].blob) : null;
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

      const nextFrameAt = startedAt + (index + 1) * this.options.chunkMs;
      const delayMs = Math.max(0, nextFrameAt - performance.now());
      if (delayMs > 0) {
        await this.wait(delayMs);
      }

      if (nextBitmapPromise) {
        currentBitmap = await nextBitmapPromise;
        const afterNext = frames[index + 2];
        nextBitmapPromise = afterNext ? createImageBitmap(afterNext.blob) : null;
      }
    }

    const recordedMs = performance.now() - startedAt;

    if (recorder.state !== 'inactive') {
      recorder.requestData();
      recorder.stop();
    }

    const rawBlob = await stopped;

    // Chrome's MediaRecorder CÓ ghi Duration vào header webm khi assemble Blob từ các chunk
    // ondataavailable, nhưng ghi giá trị SAI (đã verify bằng ffprobe trên file thật: header báo
    // "Duration: 00:00:00.00" — giá trị thật lưu bên trong chỉ là "1" đơn vị TimecodeScale, tức
    // 1ms — dù decode được đủ 100% frame, ~10s data thật). Vì vậy <video> (kể cả phát từ blob:
    // URL nội bộ) đọc duration ra 0:00 và không chịu phát, trong khi data KHÔNG hề bị mất/hỏng.
    // Vá lại header bằng patchWebmDuration (ghi đè byte tại chỗ, không re-encode) trước khi trả
    // về — nếu vá lỗi (vd cấu trúc file khác thường) thì vẫn trả blob gốc thay vì chặn evidence.
    try {
      return await patchWebmDuration(rawBlob, recordedMs);
    } catch {
      return rawBlob;
    }
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

    // Path tương đối trước đây chỉ chạy được ở local dev nhờ proxy trong vite.config.ts — trên
    // Vercel không có proxy đó nên phải ghép sẵn API_BASE_URL để trỏ đúng backend thật.
    const storageResponse = await fetch(`${API_BASE_URL}/api/storage/evidence`, {
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

  private appendActiveViolation(window: CollectionWindow, violation: EvidenceViolationMetadata) {
    const hasSameType = window.violations.some((active) => active.violationType === violation.violationType);
    if (hasSameType) return;

    const isHeadEyePair = (
      (violation.violationType === 'HEAD_TURN' && window.violations.some((active) => active.violationType === 'EYE_DIVERSION'))
      || (violation.violationType === 'EYE_DIVERSION' && window.violations.some((active) => active.violationType === 'HEAD_TURN'))
    );
    if (isHeadEyePair) return;

    window.violations.push(violation);
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
