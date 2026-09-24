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
// chạy nền — khi vi phạm xảy ra, "nhận" lấy đúng phiên đang chạy đó (claimPreRoll) và ghi TIẾP cho
// đủ tổng clipMs, KHÔNG dừng rồi mở phiên mới. Vì là ĐÚNG 1 phiên MediaRecorder liên tục từ trước
// khi có vi phạm, video có sẵn header hợp lệ ngay từ đầu — không phải ghép nhiều file rời (rủi ro
// thiếu header đã lường trước, xem trao đổi trước đó).
//
// PRE_ROLL_MIN_MS: đảm bảo TỐI THIỂU đúng khoảng này của đoạn "trước" cho vi phạm KẾ TIẾP — bằng
// cách kéo dài `busy` (nếu cần) sau mỗi violation cho tới khi pre-roll (vừa refill lúc quay xong,
// xem claimPreRoll) đã tích đủ mốc này, xem chỗ tính waitMs trong recordEvidence() — CHỦ ĐỘNG chờ
// đủ chứ không chỉ dựa vào cooldown cấu hình + hy vọng may rủi (cách làm trước: 2 slot xen kẽ,
// chọn slot elapsed lớn hơn — vẫn có thể không đủ nếu 2 vi phạm xảy ra quá sát nhau, đã verify
// thực tế bị vậy). Đảm bảo này chỉ áp dụng chắc chắn cho vi phạm XẢY RA NGAY SAU vi phạm trước —
// nếu cách nhau rất lâu (học sinh bình thường một lúc lâu), slot pre-roll có thể đã tự rotate lại
// (xem PRE_ROLL_ROTATE_MS) nên quay về mức ngẫu nhiên 0-PRE_ROLL_ROTATE_MS như thiết kế đơn giản.
const PRE_ROLL_MIN_MS = 4000;
// Nếu không có violation nào "nhận" pre-roll trong khoảng này, tự huỷ + mở slot mới — CHỈ để giới
// hạn kích thước clip/bộ nhớ (browser không flush ondataavailable nếu không gọi requestData/stop,
// nên 1 slot bị bỏ quên rất lâu sẽ giữ ngày càng nhiều dữ liệu chưa flush trong bộ nhớ). Đặt rộng
// hơn PRE_ROLL_MIN_MS khá nhiều để không rotate mất ngay lúc vừa chờ đủ mốc tối thiểu xong.
const PRE_ROLL_ROTATE_MS = 10_000;

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
  // Phiên MediaRecorder pre-roll hiện tại — null khi chưa kịp khởi động (vd vừa gọi start()) hoặc
  // đang chờ tạo lại (giữa lúc claim và lúc quay xong, xem claimPreRoll()).
  private preRoll: { recorder: MediaRecorder; chunks: Blob[]; startedAt: number; rotateTimer: number } | null = null;
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
    this.startPreRoll();
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

      // "Nhận" lấy phiên pre-roll đang chạy sẵn (đã ghi được đoạn TRƯỚC lúc violation này xảy ra —
      // tối thiểu PRE_ROLL_MIN_MS nếu violation này xảy ra ngay sau 1 violation khác, xem waitMs ở
      // finally dưới) và ghi TIẾP tới khi đủ tổng clipMs — SONG SONG với việc POST log, không đợi
      // log tạo xong mới quay. claimPreRoll() thao tác đồng bộ ngay trong lời gọi này (không có
      // await nào trước đó) nên không mất thêm khoảnh khắc nào. Trước đây gọi recordClip() MỚI ở
      // đúng lúc violation xảy ra — camera CHỈ bắt đầu ghi từ T=0, không có đoạn "trước" (giáo viên
      // chỉ thấy hậu quả, không thấy được đầu đuôi vi phạm).
      const clipPromise = this.claimPreRoll(this.options.clipMs);

      let violationId: string | null = null;
      // false khi BE chặn (max count / cooldown / cùng loại liên tiếp) và trả lại log CŨ — khi đó
      // clip này không có log nào để gắn vào, phải bỏ chứ không upload đè evidence của log cũ.
      let isNewLog = true;
      try {
        const created = await this.postViolationLog(violation, timestampIso);
        violationId = created?.id ?? null;
        isNewLog = created?.isNew ?? true;
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

      if (!isNewLog) {
        // BE không tạo log mới → không upload, giữ clip ở local (không tính là lỗi upload).
        onUpdate({ ...withVideo, uploadStatus: 'local' });
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
      // Chờ ĐỦ CẢ 2 điều kiện trước khi cho phép bắt violation tiếp theo: (1) cooldown cấu hình
      // (cooldownAfterClipMs), VÀ (2) pre-roll (đã refill lúc quay xong, xem claimPreRoll) đã tích
      // đủ PRE_ROLL_MIN_MS — lấy khoảng LỚN HƠN trong 2. Nếu cooldown đã đủ dài thì không cần chờ
      // thêm; nếu cooldown ngắn hơn mức pre-roll cần, tự kéo dài thêm đúng phần thiếu — đảm bảo
      // violation KẾ TIẾP (nếu xảy ra ngay khi vừa hết chờ) LUÔN có đủ đoạn "trước", không còn phụ
      // thuộc may rủi thời điểm như trước.
      const preRollElapsedSoFar = this.preRoll ? performance.now() - this.preRoll.startedAt : 0;
      const preRollCatchUpMs = Math.max(PRE_ROLL_MIN_MS - preRollElapsedSoFar, 0);
      const waitMs = Math.max(this.options.cooldownAfterClipMs, preRollCatchUpMs);
      await this.wait(waitMs);
      if (this.generation === myGeneration) {
        this.busy = false;
        this.busySince = null;
        // Chỉ còn là lớp phòng hờ — slot vừa bị claim đã được refill NGAY từ trong claimPreRoll()
        // (không đợi tới đây) nên bình thường đã đang chạy sẵn rồi; gọi lại ở đây vô hại (no-op)
        // trừ khi vì lý do gì chưa kịp khởi động.
        this.startPreRoll();
      }
    }
  }

  /** Bắt đầu (hoặc bỏ qua nếu đã có sẵn/không đủ điều kiện) 1 phiên pre-roll — tự huỷ + khởi động
   *  lại sau PRE_ROLL_ROTATE_MS nếu không có violation nào "nhận" lấy nó kịp (chỉ để giới hạn kích
   *  thước/bộ nhớ, xem giải thích ở PRE_ROLL_ROTATE_MS phía trên) — KHÔNG chặn theo `busy`: pre-roll
   *  là recorder ĐỘC LẬP với recorder đang thực sự ghi violation hiện tại (`activeRecorder`), vẫn
   *  an toàn chạy song song suốt lúc busy. */
  private startPreRoll() {
    if (!this.stream || !this.isRunning || this.preRoll) return;

    const recorder = new MediaRecorder(this.stream, {
      ...(this.mimeType ? { mimeType: this.mimeType } : {}),
      videoBitsPerSecond: this.options.videoBitsPerSecond,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.start();

    const rotateTimer = window.setTimeout(() => this.rotatePreRoll(), PRE_ROLL_ROTATE_MS);
    this.preRoll = { recorder, chunks, startedAt: performance.now(), rotateTimer };
  }

  /** Hết PRE_ROLL_ROTATE_MS mà không có violation nào nhận lấy phiên hiện tại — bỏ (không cần lấy
   *  blob, không ai dùng tới) rồi mở phiên mới thay vào. */
  private rotatePreRoll() {
    const current = this.preRoll;
    this.preRoll = null;
    if (current && current.recorder.state !== 'inactive') {
      current.recorder.onstop = null;
      current.recorder.stop();
    }
    this.startPreRoll();
  }

  private stopPreRoll() {
    const current = this.preRoll;
    this.preRoll = null;
    if (!current) return;

    window.clearTimeout(current.rotateTimer);
    if (current.recorder.state !== 'inactive') {
      current.recorder.onstop = null;
      current.recorder.stop();
    }
  }

  /** "Nhận" lấy phiên pre-roll đang chạy (nếu có) và ghi TIẾP cho tới khi tổng thời lượng (tính từ
   *  lúc phiên đó bắt đầu, KHÔNG phải từ bây giờ) đạt targetTotalMs — vẫn là ĐÚNG 1 MediaRecorder
   *  liên tục nên không có rủi ro thiếu header. Nếu chưa có pre-roll sẵn (vd vừa Start() xong, chưa
   *  kịp qua 1 nhịp) thì quay mới từ đây, không có đoạn "trước". */
  private claimPreRoll(targetTotalMs: number): Promise<Blob | null> {
    const current = this.preRoll;
    this.preRoll = null;

    if (!current || current.recorder.state === 'inactive') {
      return this.recordClip(targetTotalMs);
    }

    window.clearTimeout(current.rotateTimer);
    const elapsedMs = performance.now() - current.startedAt;
    const remainingMs = Math.max(targetTotalMs - elapsedMs, 500);

    return new Promise((resolve) => {
      const { recorder, chunks } = current;

      const finish = (blob: Blob | null) => {
        this.recording = false;
        this.activeRecorder = null;
        // Refill NGAY SAU KHI quay xong (không phải ngay lúc claim) — nếu refill ngay lúc claim,
        // phiên mới sẽ bắt đầu ghi ĐÚNG lúc violation này còn đang quay, khiến "trước" của
        // violation KẾ TIẾP chứa cả cảnh của violation NÀY (dính frame vi phạm trước). Refill ở
        // đây: chỉ bắt đầu sau khi camera đã dừng ghi clip này, nên không chồng lấn nội dung. Tối
        // đa 2 recorder chạy song song 1 lúc (không phải 3): trong lúc quay chỉ có recorder đang
        // quay; pre-roll mới chỉ "sống lại" ngay khi recorder đó vừa dừng.
        this.startPreRoll();
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
  //
  // Trả thêm `isNew`: response của trường hợp bị chặn và trường hợp tạo mới CÓ CÙNG hình dạng (đều
  // 201 + 1 log) nên phân biệt bằng recordedAt — log mới luôn mang đúng recordedAt FE vừa gửi, còn
  // log cũ được trả lại thì recordedAt sớm hơn. Cần biết để KHÔNG upload clip mới đè lên log cũ
  // (làm mất evidence của vi phạm trước) khi BE không tạo record mới.
  private async postViolationLog(
    violation: ViolationEvent,
    timestampIso: string,
  ): Promise<{ id: string; isNew: boolean } | null> {
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

    const logData = (await logResponse.json()) as {
      id?: string;
      recordedAt?: string;
      data?: { id?: string; recordedAt?: string };
    };
    const id = logData.id ?? logData.data?.id ?? null;
    if (!id) return null;

    // Chuỗi thời gian không có múi giờ (thiếu 'Z' hoặc ±hh:mm) sẽ bị Date.parse hiểu là giờ máy —
    // lệch 7 tiếng ở VN, khiến log mới bị nhầm là "cũ" và mất upload — nên coi là UTC.
    const returnedAtRaw = logData.recordedAt ?? logData.data?.recordedAt;
    const returnedAt = returnedAtRaw
      ? Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(returnedAtRaw) ? returnedAtRaw : `${returnedAtRaw}Z`)
      : Number.NaN;
    // Chỉ coi là log CŨ khi recordedAt trả về sớm hơn hẳn thời điểm vừa gửi (>1s); không đọc được
    // (NaN / BE không trả field) thì giữ hành vi cũ: coi là log mới.
    const isExisting = Number.isFinite(returnedAt) && Date.parse(timestampIso) - returnedAt > 1000;
    return { id, isNew: !isExisting };
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
