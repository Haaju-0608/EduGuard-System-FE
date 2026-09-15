import type { EvidenceItem, EvidenceViolationMetadata, ViolationType, ViolationEvent } from '../types/proctoring';
import { API_BASE_URL } from '../../services/apiClient';
import { getAccessToken } from '../../services/authStorage';

// Ghi evidence TRỰC TIẾP từ MediaStream camera bằng MediaRecorder — mỗi violation là 1 phiên ghi
// hình MỚI, độc lập, có header WebM đầy đủ ngay từ đầu, browser tự lo toàn bộ việc mã hoá đúng
// nhịp thật. KHÔNG còn tự chụp ảnh JPEG rời rạc rồi ghép lại bằng tay (canvas.captureStream() +
// tự bơm frame + tự tính lại duration) như bản cũ (xem EvidenceRecorderSnapshotLegacy.ts) — cách
// đó qua nhiều lần sửa vẫn còn lỗi (dài gấp đôi thời gian thật, đứng hình giữa clip, ảnh ma/xé
// hình) vì tự dựng lại video từ ảnh tĩnh vốn rất dễ vỡ. Cách này đơn giản và chắc chắn hơn nhiều,
// đổi lại: KHÔNG còn quay được đoạn "trước khi vi phạm xảy ra" nữa (ghi hình chỉ có thể bắt đầu
// từ lúc gọi start(), không thể lùi lại quá khứ) — chỉ quay từ lúc phát hiện vi phạm trở đi. Vì
// vi phạm chỉ được tính sau khi hành vi bất thường đã kéo dài đủ ngưỡng (1.2-1.8s+), video vẫn
// cho thấy học sinh tiếp diễn hành vi đó ngay sau khi bị bắt, chỉ là không có đoạn "trước đó".

// Map FE violation types → BE enum values (AcademicRequestDtos.cs ViolationType)
// BE có đủ: Impersonation | GazeDiversion | MultipleFaces | Absence | HeadTurn | FaceObstructed
const VIOLATION_TYPE_MAP: Record<ViolationType, string> = {
  EYE_DIVERSION:   'GazeDiversion',
  HEAD_TURN:       'HeadTurn',
  ABSENCE:         'Absence',
  MULTIPLE_FACE:   'MultipleFaces',
  FACE_OBSTRUCTED: 'FaceObstructed',
};

// Tổng thời lượng 1 clip evidence — trước đây chia 4s "trước" + 4s "sau" vi phạm, giờ không còn
// "trước" nữa nên dồn hết vào "sau" để clip vẫn đủ dài làm bằng chứng.
const DEFAULT_CLIP_MS = 8000;
// Khoảng nghỉ SAU KHI ghi xong 1 clip (đã upload), trước khi cho phép bắt violation tiếp theo —
// tính từ lúc xử lý xong, không phải từ lúc violation bắt đầu. Cùng với `busy`, đảm bảo LUÔN chỉ
// xử lý đúng 1 violation tại 1 thời điểm — không log/không video nào bị "rỗng" nữa.
const DEFAULT_COOLDOWN_AFTER_CLIP_MS = 5000;
const DEFAULT_VIDEO_BITS_PER_SECOND = 2_600_000;
const DEFAULT_PARTICIPATION_ID = 'local-ai-prototype';
const DEFAULT_SESSION_ID = 'local-session';
const DEFAULT_STUDENT_ID = 'local-student';

interface EvidenceRecorderOptions {
  uploadUrl?: string;
  participationId?: string;
  sessionId?: string;
  studentId?: string;
  clipMs?: number;
  cooldownAfterClipMs?: number;
  videoBitsPerSecond?: number;
}

export class EvidenceRecorder {
  private stream: MediaStream | null = null;
  private mimeType = '';
  private isRunning = false;
  // true suốt từ lúc bắt đầu ghi 1 violation tới hết cooldown sau khi ghi+upload xong — trong lúc
  // này MỌI violation mới đều bị BỎ QUA hoàn toàn (không log, không video), đúng yêu cầu "xử lý
  // xong 1 cái mới bắt cái mới".
  private busy = false;
  private options: Required<Omit<EvidenceRecorderOptions, 'uploadUrl'>> & Pick<EvidenceRecorderOptions, 'uploadUrl'>;

  constructor(options: EvidenceRecorderOptions = {}) {
    this.options = {
      uploadUrl: options.uploadUrl,
      participationId: options.participationId ?? DEFAULT_PARTICIPATION_ID,
      sessionId: options.sessionId ?? DEFAULT_SESSION_ID,
      studentId: options.studentId ?? DEFAULT_STUDENT_ID,
      clipMs: options.clipMs ?? DEFAULT_CLIP_MS,
      cooldownAfterClipMs: options.cooldownAfterClipMs ?? DEFAULT_COOLDOWN_AFTER_CLIP_MS,
      videoBitsPerSecond: options.videoBitsPerSecond ?? DEFAULT_VIDEO_BITS_PER_SECOND,
    };
  }

  /** true suốt từ lúc bắt đầu ghi 1 violation tới hết cooldown — dùng để useAiProctoring.ts tạm
   *  dừng chạy MediaPipe (không có lý do detect thêm trong lúc mọi violation mới đều bị bỏ qua). */
  get isBusy() {
    return this.busy;
  }

  start(video: HTMLVideoElement) {
    this.stop();

    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser.');
    }

    const stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
    if (!stream) {
      throw new Error('Video element has no live camera MediaStream to record from.');
    }

    this.stream = stream;
    this.mimeType = this.resolveMimeType();
    this.isRunning = true;
  }

  /** Không còn cần chụp frame rời rạc (MediaRecorder tự ghi trực tiếp từ camera) — giữ lại hàm
   *  này dạng no-op để useAiProctoring.ts không cần đổi gì (vẫn gọi tick() mỗi rAF như trước). */
  tick(_now: number) {
    // no-op
  }

  /**
   * Tách rời 2 việc để cả học sinh lẫn giáo viên thấy thông báo NGAY, không phải đợi 8s quay +
   * upload video xong mới biết có vi phạm: (1) POST /api/violation-logs NGAY LẬP TỨC — BE tạo
   * record + bắn SignalR ViolationDetected cho cả 2 bên liền; (2) quay clip + upload video CHẠY
   * SAU, độc lập, không chặn bước (1). `onUpdate` được gọi NHIỀU LẦN cho cùng 1 violation (cùng
   * `item.id`) theo tiến trình: 'pending' (log đã tạo, video đang quay) → 'uploaded'/'failed' khi
   * video xử lý xong — nơi gọi (useAiProctoring.ts) tự match theo `id` để cập nhật đúng item thay
   * vì thêm mới.
   */
  async recordEvidence(violation: ViolationEvent, onUpdate: (item: EvidenceItem) => void): Promise<void> {
    if (!this.isRunning || this.busy) {
      console.debug(`[EvidenceRecorder] Busy processing a previous violation — ignoring ${violation.type}.`);
      return;
    }

    this.busy = true;
    try {
      const capturedAt = Date.now();
      const timestampIso = new Date(capturedAt).toISOString();
      const violations = [this.toViolationMetadata(violation)];

      let violationId: string | null = null;
      try {
        violationId = await this.postViolationLog(violation, timestampIso);
      } catch (error) {
        console.warn('[EvidenceRecorder] Failed to create violation log:', error);
      }

      const baseItem: EvidenceItem = {
        filename: `${violation.type}-${capturedAt}.webm`,
        id: `evidence-${violation.id}`,
        violationId: violation.id,
        violationType: violation.type,
        violations,
        capturedAt,
        videoSizeBytes: 0,
        durationMs: this.options.clipMs,
        uploadStatus: violationId ? 'pending' : this.options.uploadUrl ? 'failed' : 'local',
        ...(violationId || !this.options.uploadUrl ? {} : { uploadError: 'Failed to create violation log.' }),
      };
      onUpdate(baseItem);
      if (!this.isRunning) return;

      const videoBlob = await this.recordClip(this.options.clipMs);
      if (!this.isRunning) return;
      if (!videoBlob || videoBlob.size === 0) {
        onUpdate({ ...baseItem, uploadStatus: 'failed', uploadError: 'Recording produced an empty clip.' });
        return;
      }

      const withVideo: EvidenceItem = {
        ...baseItem,
        videoObjectUrl: URL.createObjectURL(videoBlob),
        videoSizeBytes: videoBlob.size,
      };

      if (!violationId || !this.options.uploadUrl) {
        onUpdate({ ...withVideo, uploadStatus: this.options.uploadUrl ? 'failed' : 'local' });
        return;
      }

      try {
        await this.uploadEvidenceFile(videoBlob, violationId);
        onUpdate({ ...withVideo, uploadStatus: 'uploaded' });
      } catch (error) {
        onUpdate({
          ...withVideo,
          uploadStatus: 'failed',
          uploadError: error instanceof Error ? error.message : 'Video upload failed.',
        });
      }
    } finally {
      // Cooldown tính từ NGAY SAU KHI ghi+upload xong (không phải từ lúc violation bắt đầu).
      await this.wait(this.options.cooldownAfterClipMs);
      this.busy = false;
    }
  }

  /** Ghi 1 phiên MediaRecorder MỚI, độc lập, đúng durationMs từ MediaStream hiện có — mỗi clip có
   *  header WebM riêng, không phụ thuộc/ghép với bất kỳ đoạn ghi nào khác. */
  private recordClip(durationMs: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.stream) {
        resolve(null);
        return;
      }

      const recorder = new MediaRecorder(this.stream, {
        ...(this.mimeType ? { mimeType: this.mimeType } : {}),
        videoBitsPerSecond: this.options.videoBitsPerSecond,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        // BE whitelist content-type theo chuỗi tuyệt đối ("video/webm"/"video/mp4"),
        // không chấp nhận tham số codec (vd "video/webm;codecs=vp9") → phải bỏ phần sau dấu ";"
        const rawType = recorder.mimeType || this.mimeType || 'video/webm';
        const baseType = rawType.split(';')[0].trim();
        resolve(new Blob(chunks, { type: baseType }));
      };
      recorder.onerror = () => resolve(null);

      recorder.start();
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.requestData();
          recorder.stop();
        }
      }, durationMs);
    });
  }

  updateConfig(opts: { participationId?: string; studentId?: string; sessionId?: string }) {
    if (opts.participationId) this.options.participationId = opts.participationId;
    if (opts.studentId) this.options.studentId = opts.studentId;
    if (opts.sessionId) this.options.sessionId = opts.sessionId;
  }

  stop() {
    this.isRunning = false;
    this.stream = null;
    this.mimeType = '';
    this.busy = false;
  }

  releaseEvidence(items: EvidenceItem[]) {
    items.forEach((item) => {
      if (item.videoObjectUrl) {
        URL.revokeObjectURL(item.videoObjectUrl);
      }
    });
  }

  // POST /api/violation-logs — gọi NGAY LẬP TỨC khi phát hiện vi phạm (xem recordEvidence()),
  // TRƯỚC khi quay video, để BE tạo record + bắn SignalR ViolationDetected cho cả học sinh lẫn
  // giáo viên ngay, không phải đợi 8s quay + upload video xong mới biết có vi phạm. BE tự lo
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

  // Gắn video vào 1 violation log ĐÃ TỒN TẠI (đã tạo xong ở postViolationLog, trước cả khi video
  // này bắt đầu quay) — khác bản cũ (tạo log + upload gộp trong 1 bước), giờ đây 2 việc độc lập.
  private async uploadEvidenceFile(videoBlob: Blob, violationId: string) {
    const token = getAccessToken();
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

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
      throw new Error(`Video upload failed with status ${storageResponse.status}.`);
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
