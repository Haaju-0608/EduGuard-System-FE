import type { EvidenceItem, EvidenceViolationMetadata, ViolationType, ViolationEvent } from '../types/proctoring';
import { API_BASE_URL } from '../../services/apiClient';
import { getAccessToken } from '../../services/authStorage';

// Ghi evidence TRỰC TIẾP từ MediaStream camera bằng MediaRecorder — mỗi violation là 1 phiên ghi
// hình, có header WebM đầy đủ ngay từ đầu, browser tự lo toàn bộ việc mã hoá đúng nhịp thật. KHÔNG
// tự chụp ảnh JPEG rời rạc rồi ghép lại bằng tay (canvas.captureStream() + tự bơm frame + tự tính
// lại duration) như bản cũ (xem EvidenceRecorderSnapshotLegacy.ts) — cách đó qua nhiều lần sửa vẫn
// còn lỗi (dài gấp đôi thời gian thật, đứng hình giữa clip, ảnh ma/xé hình) vì tự dựng lại video
// từ ảnh tĩnh vốn rất dễ vỡ.
//
// "Pre-roll": để giáo viên xem được cả TRƯỚC lúc vi phạm (không chỉ hậu quả), LUÔN có MediaRecorder
// chạy nền, tự khởi động lại mỗi PRE_ROLL_MS (xem startPreRollSlot/rotatePreRollSlot) — khi vi phạm
// xảy ra, "nhận" lấy đúng phiên đang chạy đó (claimPreRoll) và ghi TIẾP cho đủ tổng clipMs, KHÔNG
// dừng rồi mở phiên mới. Vì là ĐÚNG 1 phiên MediaRecorder liên tục từ trước khi có vi phạm, video
// có sẵn header hợp lệ ngay từ đầu — không phải ghép nhiều file rời (rủi ro thiếu header đã lường
// trước, xem trao đổi trước đó).
//
// Chạy 2 SLOT xen kẽ (lệch pha nhau đúng nửa chu kỳ, xem start()) thay vì 1 — vì nếu chỉ 1 slot,
// lúc vi phạm rơi ĐÚNG NGAY SAU khi slot đó vừa tự khởi động lại thì đoạn "trước" gần như 0s (đã
// verify bằng cách tự dựng trang phát từng frame của 1 clip thật — thấy rõ trường hợp elapsed chỉ
// ~0.6-1s dù PRE_ROLL_MS=5000). Với 2 slot lệch pha, claimPreRoll() luôn chọn slot có elapsed LỚN
// HƠN trong 2 — đảm bảo tối thiểu ~PRE_ROLL_MS/2, tối đa gần PRE_ROLL_MS. Đổi lại: 2 MediaRecorder
// chạy nền cùng lúc thay vì 1 (thêm 1 chút tải nền, không đụng camera lúc `recording=true` thật).
const PRE_ROLL_MS = 5000;
const PRE_ROLL_SLOT_COUNT = 2;

// "Watchdog": trình duyệt có thể tạm ngưng/giảm tần suất chạy setTimeout khi tab bị ẩn (chuyển tab
// khác) — nếu đúng lúc đó có 1 violation đang xử lý (quay/upload/cooldown), timer quyết định lúc
// nào dừng quay hoặc hết cooldown có thể bị trễ rất lâu (hoặc quan sát thực tế: dù quay lại tab
// cũng không tự hết `busy`). Hệ quả: `busy` bị kẹt mãi = không detect được vi phạm nào nữa (cả
// video cũ lẫn vi phạm mới), y hệt hiện tượng "tab ra tab vào rồi không bắt được gì nữa" đã gặp.
// Kiểm tra định kỳ: nếu `busy` kéo dài bất thường (vượt xa tổng thời gian tối đa hợp lý của 1 lần
// xử lý bình thường: quay + upload + cooldown), ép dừng recorder đang treo và reset `busy` để
// detect tiếp tục — chấp nhận đánh đổi: lần vi phạm bị kẹt đó có thể có video ngắn/thiếu hơn dự
// kiến, còn hơn để cả hệ thống đứng im tới hết ca thi.
const STUCK_RECOVERY_MS = 20_000;
const STUCK_RECOVERY_CHECK_INTERVAL_MS = 5_000;

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
// xử lý đúng 1 violation tại 1 thời điểm — không log/không video nào bị "rỗng" nữa. Để ngắn (1s)
// vì không cần dài hơn: việc "không bắt trùng đoạn lặp lại của vi phạm cũ" đã do vote-window reset
// + activeEmission state machine trong ViolationEngine.ts tự lo (độc lập với giá trị này) — cooldown
// dài hơn chỉ tạo thêm "vùng mù" không detect được gì, không có lợi ích chống trùng nào thêm. Việc
// clip TRƯỚC không dính frame của clip SAU cũng không phụ thuộc giá trị này — `busy` đã tự đảm bảo
// KHÔNG có 2 MediaRecorder nào chạy chồng lấn (violation mới bị bỏ qua hoàn toàn cho tới khi busy
// hết), nên dù cooldown = 0 vẫn không có chuyện 2 clip lẫn frame vào nhau.
const DEFAULT_COOLDOWN_AFTER_CLIP_MS = 1000;
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
  // này MỌI violation mới đều bị BỎ QUA hoàn toàn (không log, không video): xử lý xong 1 vi phạm
  // rồi mới bắt đầu ghi nhận vi phạm tiếp theo, không cho phép chồng lấn.
  private busy = false;
  // true CHỈ trong đúng lúc MediaRecorder đang quay clip thật (8s) — hẹp hơn `busy` (không tính
  // lúc upload/cooldown). useAiProctoring.ts dùng riêng cờ này để tạm dừng MediaPipe CHỈ trong lúc
  // quay: để MediaPipe chạy song song lúc upload/cooldown (giảm điểm mù) nhưng vẫn bảo vệ chất
  // lượng clip đang ghi — MediaPipe (WASM/GL, đọc frame từ cùng camera stream) tranh tài nguyên
  // GPU/decode với MediaRecorder trong lúc quay có thể làm clip bị lỗi/rỗng (đã xảy ra thật khi
  // từng bỏ pause suốt cả `busy`, xem lịch sử sửa ở useAiProctoring.ts).
  private recording = false;
  // 2 slot pre-roll xen kẽ (xem PRE_ROLL_MS ở trên) — mỗi phần tử null khi chưa kịp khởi động (vd
  // vừa gọi start(), hoặc slot vừa bị claim/rotate xong đang chờ tạo lại) hoặc đang busy.
  private preRollSlots: Array<{ recorder: MediaRecorder; chunks: Blob[]; startedAt: number; rotateTimer: number } | null> =
    new Array(PRE_ROLL_SLOT_COUNT).fill(null);
  // Mốc thời gian lúc `busy` chuyển thành true — dùng để watchdog phát hiện kẹt quá lâu (xem
  // STUCK_RECOVERY_MS). MediaRecorder đang thực sự ghi (không phải pre-roll chờ) tại thời điểm đó,
  // để watchdog có thể ép dừng đúng recorder bị treo.
  private busySince: number | null = null;
  private activeRecorder: MediaRecorder | null = null;
  private watchdogTimer: number | null = null;
  // Tăng mỗi lần recordEvidence() bắt đầu HOẶC watchdog ép reset — xem myGeneration trong
  // recordEvidence()/checkStuck().
  private generation = 0;
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

  /** true suốt từ lúc bắt đầu ghi 1 violation tới hết cooldown — dùng để bỏ qua việc xử lý (thêm
   *  vào list/gọi recordEvidence) các violation mới phát hiện được trong lúc này, vì chắc chắn sẽ
   *  bị recordEvidence() tự bỏ qua — tránh hiện "vi phạm ma" không được ghi log/video lên UI. */
  get isBusy() {
    return this.busy;
  }

  /** true CHỈ trong lúc MediaRecorder đang quay clip thật — xem giải thích ở field `recording`. */
  get isRecording() {
    return this.recording;
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
    this.watchdogTimer = window.setInterval(() => this.checkStuck(), STUCK_RECOVERY_CHECK_INTERVAL_MS);

    // Khởi động từng slot LỆCH NHAU đúng 1/PRE_ROLL_SLOT_COUNT chu kỳ — để claimPreRoll() luôn có
    // ít nhất 1 slot đã chạy được một khoảng "đáng kể" (xem giải thích ở PRE_ROLL_MS phía trên).
    for (let i = 0; i < PRE_ROLL_SLOT_COUNT; i++) {
      const delay = (PRE_ROLL_MS / PRE_ROLL_SLOT_COUNT) * i;
      if (delay <= 0) this.startPreRollSlot(i);
      else window.setTimeout(() => this.startPreRollSlot(i), delay);
    }
  }

  /** Không còn cần chụp frame rời rạc (MediaRecorder tự ghi trực tiếp từ camera) — giữ lại hàm
   *  này dạng no-op để useAiProctoring.ts không cần đổi gì (vẫn gọi tick() mỗi rAF như trước). */
  tick(_now: number) {
    // no-op
  }

  /**
   * Tách rời 2 việc, chạy SONG SONG (không phải nối tiếp) ngay từ T=0: (1) quay clip — bắt đầu
   * NGAY, đồng bộ, để không mất khoảnh khắc vi phạm thật; (2) POST /api/violation-logs — để BE
   * tạo record + bắn SignalR ViolationDetected cho cả học sinh lẫn giáo viên ngay, không đợi 8s
   * quay + upload xong mới biết có vi phạm. `onUpdate` được gọi NHIỀU LẦN cho cùng 1 violation
   * (cùng `item.id`) theo tiến trình: 'pending' (log đã tạo, video đang quay) → 'uploaded'/'failed'
   * khi video xử lý xong — nơi gọi (useAiProctoring.ts) tự match theo `id` để cập nhật đúng item
   * thay vì thêm mới.
   */
  async recordEvidence(violation: ViolationEvent, onUpdate: (item: EvidenceItem) => void): Promise<void> {
    if (!this.isRunning || this.busy) {
      console.debug(`[EvidenceRecorder] Busy processing a previous violation — ignoring ${violation.type}.`);
      return;
    }

    this.busy = true;
    this.busySince = Date.now();
    // Token riêng cho lần gọi này — nếu watchdog (checkStuck) ép reset xong rồi có 1 violation KHÁC
    // được nhận xử lý (this.generation tăng lên), thì khi promise của lần gọi NÀY (bị treo, giờ
    // mới giải quyết xong muộn) chạy tới finally, nó sẽ KHÔNG được phép dọn dẹp `busy`/pre-roll —
    // tránh giẫm lên state của lần xử lý mới đang chạy thật.
    const myGeneration = ++this.generation;
    try {
      const capturedAt = Date.now();
      const timestampIso = new Date(capturedAt).toISOString();
      const violations = [this.toViolationMetadata(violation)];

      // "Nhận" lấy phiên pre-roll đang chạy sẵn (đã ghi được ~0-2s TRƯỚC lúc violation này xảy ra)
      // và ghi TIẾP tới khi đủ tổng clipMs — SONG SONG với việc POST log, không đợi log tạo xong
      // mới quay. claimPreRoll() thao tác đồng bộ ngay trong lời gọi này (không có await nào trước
      // đó) nên không mất thêm khoảnh khắc nào. Trước đây gọi recordClip() MỚI ở đúng lúc violation
      // xảy ra — camera CHỈ bắt đầu ghi từ T=0, không có đoạn "trước" (giáo viên chỉ thấy hậu quả,
      // không thấy được đầu đuôi vi phạm).
      const clipPromise = this.claimPreRoll(this.options.clipMs);

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

      const videoBlob = await clipPromise;
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
      if (this.generation === myGeneration) {
        this.busy = false;
        this.busySince = null;
        // Chuẩn bị sẵn 1 phiên pre-roll MỚI ngay khi hết cooldown, để violation KẾ TIẾP cũng có
        // sẵn đoạn "trước" — không phải đợi PRE_ROLL_MS đầu tiên mới có.
        this.startPreRoll();
      }
    }
  }

  /** Bắt đầu (hoặc bỏ qua nếu slot đó đã có sẵn/không đủ điều kiện) 1 slot pre-roll — tự huỷ + khởi
   *  động lại slot đó sau PRE_ROLL_MS nếu không có violation nào "nhận" lấy nó kịp. Dùng để "refill"
   *  từng slot RIÊNG (không đụng slot khác) — xem chỗ gọi ở finally của recordEvidence/checkStuck. */
  private startPreRollSlot(index: number) {
    if (!this.stream || !this.isRunning || this.busy || this.preRollSlots[index]) return;

    const recorder = new MediaRecorder(this.stream, {
      ...(this.mimeType ? { mimeType: this.mimeType } : {}),
      videoBitsPerSecond: this.options.videoBitsPerSecond,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.start();

    const rotateTimer = window.setTimeout(() => this.rotatePreRollSlot(index), PRE_ROLL_MS);
    this.preRollSlots[index] = { recorder, chunks, startedAt: performance.now(), rotateTimer };
  }

  /** Refill TẤT CẢ slot đang trống (null) — dùng ở những chỗ không cần biết slot nào vừa được giải
   *  phóng (sau cooldown, sau watchdog reset...): slot đang chạy dở vẫn được giữ nguyên, không đụng. */
  private startPreRoll() {
    for (let i = 0; i < this.preRollSlots.length; i++) this.startPreRollSlot(i);
  }

  /** Hết PRE_ROLL_MS mà không có violation nào nhận lấy slot này — bỏ (không cần lấy blob, không ai
   *  dùng tới) rồi mở slot mới thay vào, GIỮ ĐÚNG index đó (không ảnh hưởng slot còn lại). */
  private rotatePreRollSlot(index: number) {
    const current = this.preRollSlots[index];
    this.preRollSlots[index] = null;
    if (current && current.recorder.state !== 'inactive') {
      current.recorder.onstop = null;
      current.recorder.stop();
    }
    this.startPreRollSlot(index);
  }

  private stopPreRoll() {
    for (let i = 0; i < this.preRollSlots.length; i++) {
      const current = this.preRollSlots[i];
      this.preRollSlots[i] = null;
      if (!current) continue;

      window.clearTimeout(current.rotateTimer);
      if (current.recorder.state !== 'inactive') {
        current.recorder.onstop = null;
        current.recorder.stop();
      }
    }
  }

  /** "Nhận" lấy slot pre-roll đã chạy LÂU NHẤT (elapsed lớn nhất trong các slot đang sống) và ghi
   *  TIẾP cho tới khi tổng thời lượng (tính từ lúc slot đó bắt đầu, KHÔNG phải từ bây giờ) đạt
   *  targetTotalMs — vẫn là ĐÚNG 1 MediaRecorder liên tục nên không có rủi ro thiếu header. Slot
   *  còn lại (nếu có) tiếp tục chạy độc lập, không bị đụng tới. Nếu chưa có slot nào sẵn (vd vừa
   *  Start() xong, chưa kịp qua PRE_ROLL_MS/PRE_ROLL_SLOT_COUNT đầu tiên) thì quay mới từ đây,
   *  không có đoạn "trước". */
  private claimPreRoll(targetTotalMs: number): Promise<Blob | null> {
    let bestIndex = -1;
    let bestElapsed = -1;
    for (let i = 0; i < this.preRollSlots.length; i++) {
      const slot = this.preRollSlots[i];
      if (!slot || slot.recorder.state === 'inactive') continue;
      const elapsed = performance.now() - slot.startedAt;
      if (elapsed > bestElapsed) {
        bestElapsed = elapsed;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      return this.recordClip(targetTotalMs);
    }

    const current = this.preRollSlots[bestIndex]!;
    this.preRollSlots[bestIndex] = null;

    window.clearTimeout(current.rotateTimer);
    const elapsedMs = performance.now() - current.startedAt;
    const remainingMs = Math.max(targetTotalMs - elapsedMs, 500);

    return new Promise((resolve) => {
      const { recorder, chunks } = current;

      const finish = (blob: Blob | null) => {
        this.recording = false;
        this.activeRecorder = null;
        resolve(blob);
      };

      recorder.onstop = () => {
        const rawType = recorder.mimeType || this.mimeType || 'video/webm';
        const baseType = rawType.split(';')[0].trim();
        finish(new Blob(chunks, { type: baseType }));
      };
      recorder.onerror = () => finish(null);

      this.recording = true;
      this.activeRecorder = recorder;
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.requestData();
          recorder.stop();
        }
      }, remainingMs);
    });
  }

  /** Ghi 1 phiên MediaRecorder MỚI từ đầu, đúng durationMs — dùng làm fallback khi claimPreRoll()
   *  không có phiên pre-roll nào sẵn để nhận (không có đoạn "trước" trong trường hợp này). */
  private recordClip(durationMs: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.stream) {
        resolve(null);
        return;
      }

      const finish = (blob: Blob | null) => {
        this.recording = false;
        this.activeRecorder = null;
        resolve(blob);
      };

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
        finish(new Blob(chunks, { type: baseType }));
      };
      recorder.onerror = () => finish(null);

      this.recording = true;
      this.activeRecorder = recorder;
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
    if (this.watchdogTimer !== null) {
      window.clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.stopPreRoll();
    this.stream = null;
    this.mimeType = '';
    this.busy = false;
    this.busySince = null;
    this.activeRecorder = null;
    this.recording = false;
  }

  /** Chạy định kỳ (xem STUCK_RECOVERY_MS) — nếu `busy` kéo dài bất thường (nghi do trình duyệt
   *  ngưng/trễ timer lúc tab bị ẩn), ép dừng recorder đang treo (nếu còn) và reset `busy` ngay,
   *  KHÔNG đợi promise của lần recordEvidence() đang treo tự giải quyết (nó vẫn có thể tự hoàn tất
   *  muộn sau đó và gọi onUpdate() bình thường — không sao, chỉ không còn chặn các violation MỚI). */
  private checkStuck() {
    if (!this.busy || this.busySince === null) return;

    const stuckMs = Date.now() - this.busySince;
    if (stuckMs < STUCK_RECOVERY_MS) return;

    console.warn(
      `[EvidenceRecorder] Busy for ${Math.round(stuckMs / 1000)}s — likely stuck (tab was hidden and its ` +
      'timers got throttled/delayed by the browser). Forcing recovery so detection can resume.',
    );

    const recorder = this.activeRecorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (error) {
        console.warn('[EvidenceRecorder] Failed to force-stop the stuck recorder:', error);
      }
    }

    this.activeRecorder = null;
    this.recording = false;
    this.busy = false;
    this.busySince = null;
    // Vô hiệu quyền dọn dẹp của lần recordEvidence() đang bị treo — nếu promise của nó (đang
    // await clipPromise) sau đó tự giải quyết muộn, finally của nó sẽ thấy generation không khớp
    // và bỏ qua, không giẫm lên state của violation MỚI được nhận xử lý sau khi giải cứu.
    this.generation++;
    this.startPreRoll();
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
