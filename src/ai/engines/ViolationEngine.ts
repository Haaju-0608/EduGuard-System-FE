import type {
  CalibrationState,
  EyeDiversionSignal,
  FaceQuality,
  HeadTurnSignal,
  HeadPose,
  ProctoringFrameAnalysis,
  ViolationEngineThresholds,
  ViolationEvent,
  ViolationType,
} from '../types/proctoring';

const DEFAULT_THRESHOLDS: ViolationEngineThresholds = {
  absenceMs: 1200,
  multipleFaceMs: 1200,
  faceObstructedMs: 1800,
  headTurnMs: 1500,
  eyeDiversionMs: 1500,
};

const VOTE_RATIO = 0.72;
const VOTED_TYPES: ViolationType[] = ['FACE_OBSTRUCTED', 'HEAD_TURN', 'EYE_DIVERSION'];

// Quay đầu (HEAD_TURN) LUÔN kéo theo tín hiệu eye diversion tăng lên CÙNG LÚC (landmark mắt trong
// khung hình dịch theo góc nghiêng đầu, dù người dùng không hề "đảo mắt" độc lập với đầu — đã thấy
// rõ hiện tượng này khi test ở /proctoring-test). Ngưỡng thời gian của 2 loại này giờ có thể chỉnh
// riêng ở BE (Detection Thresholds) — nên KHÔNG thể giả định HEAD_TURN luôn vượt ngưỡng trước: nếu
// eyeDiversionMs được đặt thấp hơn headTurnMs, EYE_DIVERSION sẽ bắt được TRƯỚC. Vì vậy nén theo CẢ
// 2 CHIỀU — loại nào bắt được TRƯỚC thì được báo, loại còn lại nếu bắt được trong cửa sổ này ngay
// sau đó thì coi là CÙNG 1 hành vi (không báo thêm) — tránh tạo thêm 1 dòng log "ẩn" mà người dùng
// không nhận ra là do đúng 1 lần quay đầu (từng gây lệch max-violation-count: đặt max=15 nhưng chỉ
// thấy 14 lần catch thật vì 1 slot bị "ăn" bởi cặp HeadTurn+EyeDiversion tính thành 2).
const EYE_DIVERSION_HEAD_TURN_MERGE_WINDOW_MS = 1000;

const LABELS: Record<ViolationType, string> = {
  ABSENCE: 'No face detected',
  MULTIPLE_FACE: 'Multiple faces detected',
  FACE_OBSTRUCTED: 'Face or eyes obstructed',
  HEAD_TURN: 'Sustained head turn',
  EYE_DIVERSION: 'Sustained eye diversion',
};

export class ViolationEngine {
  private thresholds: ViolationEngineThresholds;
  private signalStart = new Map<ViolationType, number>();
  // Mốc thời gian LẦN BÁO GẦN NHẤT của từng loại — dùng để quyết định có báo lại không nếu hành vi
  // vẫn tiếp diễn LIÊN TỤC (xem readyToEmit ở evaluate()). Trước đây dùng 1 Set "đã báo rồi thì
  // thôi mãi mãi" — gây bug: học sinh rời khỏi khung hình (ABSENCE) và không quay lại nữa thì CHỈ
  // bị tính đúng 1 vi phạm cho TOÀN BỘ phần còn lại của ca thi, dù vẫn đang vắng mặt liên tục. Giờ
  // hành vi liên tục sẽ được báo lại đều đặn mỗi `threshold` — EvidenceRecorder.busy tự nhiên
  // throttle việc ghi log/video xuống ~1 lần mỗi ~9-10s (thời gian quay+upload+cooldown 1 clip),
  // không lo bị spam violation dù ViolationEngine muốn báo dày hơn thế.
  private lastEmittedAt = new Map<ViolationType, number>();
  private voteWindows = new Map<ViolationType, Array<{ timestamp: number; active: boolean }>>();

  constructor(thresholds: Partial<ViolationEngineThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Cập nhật lại ngưỡng thời gian sau khi khởi tạo — dùng khi lấy được cấu hình thật từ
   * GET /api/proctoring-settings/effective (xem useAiProctoring.ts), thay cho DEFAULT_THRESHOLDS
   * hard-code. Chỉ override field nào BE có trả (partial merge), field còn thiếu giữ nguyên giá
   * trị hiện tại. Gọi reset() kèm theo vì đổi ngưỡng giữa chừng một chuỗi tín hiệu đang đếm dở có
   * thể tạo ra durationMs không nhất quán (đếm dở theo ngưỡng cũ nhưng so sánh với ngưỡng mới).
   */
  setThresholds(thresholds: Partial<ViolationEngineThresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.reset();
  }

  getThresholds(): ViolationEngineThresholds {
    return { ...this.thresholds };
  }

  evaluate(params: {
    timestamp: number;
    faceCount: number;
    eyeGaze: ProctoringFrameAnalysis['eyeGaze'];
    headTurn: HeadTurnSignal | null;
    eyeDiversion: EyeDiversionSignal | null;
    headPose: HeadPose | null;
    faceQuality: FaceQuality | null;
    calibration: CalibrationState;
  }): { analysis: ProctoringFrameAnalysis; events: ViolationEvent[] } {
    const immediateSignals = this.resolveImmediateSignals(params);
    const signals = this.resolveVotedSignals(params.timestamp, immediateSignals);
    const events: ViolationEvent[] = [];

    (['ABSENCE', 'MULTIPLE_FACE', 'FACE_OBSTRUCTED', 'HEAD_TURN', 'EYE_DIVERSION'] as ViolationType[]).forEach((type) => {
      if (!signals.includes(type)) {
        this.signalStart.delete(type);
        this.lastEmittedAt.delete(type);
        return;
      }

      const isVotedType = VOTED_TYPES.includes(type);
      const startedAt = isVotedType ? params.timestamp - this.thresholdFor(type) : this.signalStart.get(type) ?? params.timestamp;
      this.signalStart.set(type, startedAt);

      const durationMs = params.timestamp - startedAt;
      const threshold = this.thresholdFor(type);
      const lastEmitted = this.lastEmittedAt.get(type);
      // Báo LẦN ĐẦU khi vượt ngưỡng, rồi báo LẶP LẠI mỗi `threshold` nếu hành vi vẫn tiếp diễn
      // liên tục (không hề dừng) — xem giải thích ở field lastEmittedAt.
      const readyToEmit = durationMs >= threshold
        && (lastEmitted === undefined || params.timestamp - lastEmitted >= threshold);

      if (readyToEmit) {
        this.lastEmittedAt.set(type, params.timestamp);

        if (type === 'HEAD_TURN') {
          const lastEyeDiversion = this.lastEmittedAt.get('EYE_DIVERSION');
          const mergedIntoRecentEyeDiversion = lastEyeDiversion !== undefined
            && params.timestamp - lastEyeDiversion <= EYE_DIVERSION_HEAD_TURN_MERGE_WINDOW_MS;
          if (mergedIntoRecentEyeDiversion) return;
        } else if (type === 'EYE_DIVERSION') {
          const lastHeadTurn = this.lastEmittedAt.get('HEAD_TURN');
          const mergedIntoRecentHeadTurn = lastHeadTurn !== undefined
            && params.timestamp - lastHeadTurn <= EYE_DIVERSION_HEAD_TURN_MERGE_WINDOW_MS;
          if (mergedIntoRecentHeadTurn) return;
        }

        events.push({
          id: `${type}-${params.timestamp}`,
          type,
          label: LABELS[type],
          severity: type === 'HEAD_TURN' || type === 'EYE_DIVERSION' || type === 'FACE_OBSTRUCTED' ? 'warning' : 'critical',
          emittedAt: params.timestamp,
          durationMs,
          metadata: {
            gaze: type === 'HEAD_TURN' ? params.headTurn?.direction : params.eyeDiversion?.direction,
            faceCount: params.faceCount,
            headPose: params.headPose ?? undefined,
            faceQuality: params.faceQuality ?? undefined,
            signalConfidence: type === 'HEAD_TURN' ? params.headTurn?.confidence : params.eyeDiversion?.confidence,
          },
        });
      }
    });

    return {
      analysis: {
        timestamp: params.timestamp,
        faceCount: params.faceCount,
        eyeGaze: params.eyeGaze,
        headTurn: params.headTurn,
        eyeDiversion: params.eyeDiversion,
        headPose: params.headPose,
        faceQuality: params.faceQuality,
        calibration: params.calibration,
        activeSignals: immediateSignals,
      },
      events,
    };
  }

  reset() {
    this.signalStart.clear();
    this.lastEmittedAt.clear();
    this.voteWindows.clear();
  }

  private resolveImmediateSignals(params: {
    faceCount: number;
    headTurn: HeadTurnSignal | null;
    eyeDiversion: EyeDiversionSignal | null;
    faceQuality: FaceQuality | null;
    calibration: CalibrationState;
  }): ViolationType[] {
    const signals: ViolationType[] = [];

    if (params.faceCount === 0) signals.push('ABSENCE');
    if (params.faceCount > 1) signals.push('MULTIPLE_FACE');
    if (params.faceCount === 1 && params.faceQuality?.obstructed) {
      signals.push('FACE_OBSTRUCTED');
    }
    if (
      params.faceCount === 1
      && params.calibration.status === 'ready'
      && params.headTurn?.active
    ) {
      signals.push('HEAD_TURN');
    }
    if (
      params.faceCount === 1
      && params.calibration.status === 'ready'
      && params.eyeDiversion?.active
    ) {
      signals.push('EYE_DIVERSION');
    }

    return signals;
  }

  private resolveVotedSignals(timestamp: number, immediateSignals: ViolationType[]): ViolationType[] {
    const stableSignals: ViolationType[] = immediateSignals.filter(
      (type) => !VOTED_TYPES.includes(type),
    );

    VOTED_TYPES.forEach((type) => {
      const active = immediateSignals.includes(type);
      const threshold = this.thresholdFor(type);
      const previous = this.voteWindows.get(type) ?? [];
      const next = [...previous, { timestamp, active }].filter((sample) => timestamp - sample.timestamp <= threshold);
      this.voteWindows.set(type, next);

      const span = next.length > 1 ? next[next.length - 1].timestamp - next[0].timestamp : 0;
      const activeCount = next.filter((sample) => sample.active).length;
      const ratio = next.length > 0 ? activeCount / next.length : 0;

      if (span >= threshold * 0.9 && ratio >= VOTE_RATIO) {
        stableSignals.push(type);
      }
    });

    return stableSignals;
  }

  private thresholdFor(type: ViolationType) {
    if (type === 'ABSENCE') return this.thresholds.absenceMs;
    if (type === 'MULTIPLE_FACE') return this.thresholds.multipleFaceMs;
    if (type === 'FACE_OBSTRUCTED') return this.thresholds.faceObstructedMs;
    if (type === 'HEAD_TURN') return this.thresholds.headTurnMs;

    return this.thresholds.eyeDiversionMs;
  }

}
