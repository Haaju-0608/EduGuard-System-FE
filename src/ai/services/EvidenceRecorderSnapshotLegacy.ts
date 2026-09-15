// ⚠️ KHÔNG CÒN ĐƯỢC DÙNG — giữ lại làm phương án dự phòng nếu cách ghi mới (EvidenceRecorder.ts,
// ghi trực tiếp từ MediaStream camera bằng MediaRecorder) gặp vấn đề không lường trước.
//
// Cách làm cũ ở file này: chụp nhiều ảnh JPEG rời rạc (tick()/captureFrame()) rồi TỰ GHÉP LẠI
// thành video bằng canvas.captureStream(0) + tự bơm frame bằng tay + tự tính lại duration
// (patchWebmDuration). Qua nhiều lần sửa (dài gấp đôi ~20s, đứng hình ở mốc 4s, ảnh ma/xé hình)
// kết luận cách này quá dễ vỡ — không dùng nữa. Muốn quay lại: đổi import trong
// useAiProctoring.ts từ `./EvidenceRecorder` sang `./EvidenceRecorderSnapshotLegacy`.
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

const DEFAULT_PRE_EVENT_MS = 4000;
const DEFAULT_FRAME_INTERVAL_MS = 67;
const DEFAULT_POST_VIOLATION_MS = 4000;
// Khoảng nghỉ SAU KHI đã cắt+upload xong 1 clip, trước khi cho phép bắt violation tiếp theo — tính
// từ lúc xử lý xong (không phải từ lúc vi phạm bắt đầu). Cùng với `busy`, đảm bảo LUÔN xử lý đúng
// 1 violation tại 1 thời điểm — không còn kiểu "gộp violation vào clip đang mở" như trước (đó là
// nguyên nhân vừa gây lệch số học sinh/giáo viên, vừa khiến 1 số violation không có evidence).
const DEFAULT_COOLDOWN_AFTER_CLIP_MS = 5000;
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
  cooldownAfterClipMs?: number;
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

export class EvidenceRecorderSnapshotLegacy {
  private video: HTMLVideoElement | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;
  private captureContext: CanvasRenderingContext2D | null = null;
  private rollingFrames: EvidenceFrame[] = [];
  private activeWindow: CollectionWindow | null = null;
  // true suốt từ lúc bắt đầu ghi 1 violation cho tới hết cooldown sau khi cắt+upload xong — trong
  // lúc này MỌI violation mới đều bị BỎ QUA hoàn toàn (không log, không video), useAiProctoring.ts
  // cũng tạm dừng luôn việc chạy MediaPipe khi thấy cờ này (đỡ tranh CPU main thread, xem
  // getMatrixData... trong processFrame) — vừa đúng yêu cầu "xử lý xong 1 cái mới bắt cái mới",
  // vừa giảm giật hình vì không còn ai tranh main thread với vòng lặp cắt video nữa.
  private busy = false;
  private lastCaptureAt = 0;
  // Thời điểm start() được gọi — dùng để CHẶN bắt violation trong DEFAULT_PRE_EVENT_MS đầu tiên
  // (xem recordEvidence). Nếu vi phạm xảy ra ngay những giây đầu (rollingFrames chưa kịp có đủ 4s
  // lịch sử thật), buildFixedClipFrames sẽ phải lặp lại frame sớm nhất cho mọi "khe" thời gian
  // trước đó → video bị đứng hình ngay từ đầu clip (đã quan sát thực tế). Bỏ qua hẳn violation
  // trong giai đoạn "chưa đủ khởi động" này còn hợp lý hơn cả — 4s đầu ca thi vốn cũng nên dành
  // cho calibration, ít ai kỳ vọng bắt vi phạm ngay tức khắc.
  private recorderStartedAt = 0;
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
      cooldownAfterClipMs: options.cooldownAfterClipMs ?? DEFAULT_COOLDOWN_AFTER_CLIP_MS,
      videoBitsPerSecond: options.videoBitsPerSecond ?? DEFAULT_VIDEO_BITS_PER_SECOND,
    };
  }

  /** true suốt từ lúc bắt đầu ghi 1 violation tới hết cooldown sau khi cắt+upload xong — dùng để
   *  useAiProctoring.ts tạm dừng chạy MediaPipe (main thread rảnh hẳn cho việc cắt video chính
   *  xác nhịp, đỡ giật/dài hơn thời gian thật) trong lúc chỉ 1 violation được xử lý tại 1 thời điểm. */
  get isBusy() {
    return this.busy;
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
    this.recorderStartedAt = Date.now();
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
    if (!this.isRunning || this.busy) {
      // Đang xử lý violation trước (ghi hình / cắt video / upload / cooldown sau đó) → BỎ QUA
      // hoàn toàn violation này, không log, không video — đúng yêu cầu "xử lý xong 1 cái mới bắt
      // cái mới". Học sinh có thể có nhiều tín hiệu vi phạm liên tiếp nhưng chỉ đúng 1 trong số đó
      // (cái đầu tiên mở được cửa sổ ghi) thực sự trở thành 1 record — không còn "violation không
      // có video" nữa vì mọi record giờ LUÔN đi kèm đủ video (composeAndUpload cắt xong mới báo).
      console.debug(`[EvidenceRecorder] Busy processing a previous violation — ignoring ${violation.type}.`);
      return null;
    }

    if (Date.now() - this.recorderStartedAt < DEFAULT_PRE_EVENT_MS) {
      // Chưa đủ DEFAULT_PRE_EVENT_MS kể từ lúc bật camera — rollingFrames chưa có đủ lịch sử thật
      // để làm phần "trước vi phạm", bỏ qua hẳn thay vì ghi 1 clip bị đứng hình ở đoạn đầu.
      console.debug(`[EvidenceRecorder] Warming up (< ${DEFAULT_PRE_EVENT_MS}ms since start) — ignoring ${violation.type}.`);
      return null;
    }

    this.busy = true;
    try {
      const violationMetadata = this.toViolationMetadata(violation);
      const now = Date.now();

      const collectionWindow: CollectionWindow = {
        startedAt: now,
        preViolationFrames: this.rollingFrames.slice(),
        postFrames: [],
        violations: [violationMetadata],
        primaryViolation: violation,
        timestampIso: new Date(now).toISOString(),
      };
      this.activeWindow = collectionWindow;

      await this.wait(this.options.postViolationMs);

      if (!this.isRunning) return null;
      this.activeWindow = null;

      const clipFrames = this.buildFixedClipFrames(
        collectionWindow.preViolationFrames,
        collectionWindow.postFrames,
        collectionWindow.startedAt,
      );
      if (clipFrames.length === 0) return null;

      const durationMs = DEFAULT_PRE_EVENT_MS + this.options.postViolationMs;

      // Cắt video XONG rồi mới gọi upload() (bên trong đó mới POST /api/violation-logs) — video
      // luôn sẵn sàng TRƯỚC khi violation được báo lên BE, không còn thứ tự ngược như trước.
      return await this.composeAndUpload(
        clipFrames,
        collectionWindow.primaryViolation,
        collectionWindow.violations,
        collectionWindow.startedAt,
        collectionWindow.timestampIso,
        durationMs,
      );
    } finally {
      // Cooldown tính từ NGAY SAU KHI cắt+upload xong (không phải từ lúc violation bắt đầu) —
      // đúng yêu cầu. Trong lúc này useAiProctoring.ts vẫn thấy isBusy = true nên MediaPipe vẫn
      // tạm dừng, main thread rảnh hoàn toàn cho browser flush xong việc mạng/encode còn sót lại.
      await this.wait(this.options.cooldownAfterClipMs);
      this.busy = false;
    }
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
    this.busy = false;
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
      currentBitmap.close();
      // Đợi đúng 1 chu kỳ compositing thật (rAF) TRƯỚC khi gọi requestFrame() — gọi ngay sau
      // drawImage() bằng vòng lặp setTimeout (không đồng bộ với nhịp vsync của trình duyệt) có
      // thể chụp đúng lúc canvas đang giữa 2 lần vẽ, gây hiện tượng 2 khung hình chồng/xé lên
      // nhau trong video evidence (đã quan sát thực tế). chunkMs (67ms) luôn lớn hơn 1 rAF tick
      // (~16ms) nên không làm lệch tổng thời lượng — phần wait(delayMs) bên dưới tự bù lại.
      await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
      manualTrack?.requestFrame();

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

  // POST /api/violation-logs — gọi SAU KHI video đã cắt xong (xem upload()). BE tự lo
  // cooldown/max-count/consecutive-type (trả về log CŨ thay vì tạo mới nếu bị chặn) — FE không tự
  // suy đoán, không throw khi bị "nuốt" theo cooldown vì đó là hành vi đúng theo thiết kế.
  private async postViolationLog(violation: ViolationEvent, timestampIso: string): Promise<string | null> {
    if (!this.options.uploadUrl) return null;

    const token = getAccessToken();
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const logResponse = await fetch(this.options.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        participationId: this.options.participationId,
        severity: violation.severity === 'critical' ? 'Severe' : 'Warning',
        violationType: VIOLATION_TYPE_MAP[violation.type] ?? violation.type,
        aiConfidence: violation.metadata.signalConfidence ?? 0,
        recordedAt: timestampIso,
      }),
    });

    if (!logResponse.ok) {
      throw new Error(`Create violation log failed with status ${logResponse.status}.`);
    }

    const logData = (await logResponse.json()) as { id?: string; data?: { id?: string } };
    return logData.id ?? logData.data?.id ?? null;
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

    const violationId = await this.postViolationLog(violation, timestampIso);
    if (!violationId) return; // Log tạo thành công (hoặc bị cooldown/dedupe) nhưng không có ID để upload video

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
