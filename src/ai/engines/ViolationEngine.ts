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
  absenceMs: 2000,
  multipleFaceMs: 1200,
  faceObstructedMs: 1800,
  headTurnMs: 1200,
  eyeDiversionMs: 1200,
};

const VOTE_RATIO = 0.72;
const VOTED_TYPES: ViolationType[] = ['FACE_OBSTRUCTED', 'HEAD_TURN', 'EYE_DIVERSION'];

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
  private activeEmission = new Set<ViolationType>();
  private voteWindows = new Map<ViolationType, Array<{ timestamp: number; active: boolean }>>();

  constructor(thresholds: Partial<ViolationEngineThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
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
        this.activeEmission.delete(type);
        return;
      }

      const isVotedType = VOTED_TYPES.includes(type);
      const startedAt = isVotedType ? params.timestamp - this.thresholdFor(type) : this.signalStart.get(type) ?? params.timestamp;
      this.signalStart.set(type, startedAt);

      const durationMs = params.timestamp - startedAt;
      if (durationMs >= this.thresholdFor(type) && !this.activeEmission.has(type)) {
        this.activeEmission.add(type);
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
    this.activeEmission.clear();
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
