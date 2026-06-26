import type {
  CalibrationProfile,
  EyeDiversionSignal,
  EyeGaze,
  FaceQuality,
  GazeDirection,
  HeadPose,
  HeadTurnSignal,
} from '../types/proctoring';
import { clamp } from '../utils/landmarkGeometry';

const HEAD_YAW_THRESHOLD = 30;
const HEAD_PITCH_THRESHOLD = 24;
const HEAD_ROLL_THRESHOLD = 28;
const EYE_HORIZONTAL_THRESHOLD = 0.15;
const EYE_VERTICAL_THRESHOLD = 0.18;

export class DiversionSignalEngine {
  detectHeadTurn(params: {
    headPose: HeadPose | null;
    faceQuality: FaceQuality | null;
    calibration: CalibrationProfile | null;
  }): HeadTurnSignal | null {
    if (!params.headPose || !params.calibration) return null;

    const headDelta = {
      yaw: params.headPose.yaw - params.calibration.yaw,
      pitch: params.headPose.pitch - params.calibration.pitch,
      roll: params.headPose.roll - params.calibration.roll,
    };

    const yawMagnitude = Math.abs(headDelta.yaw);
    const pitchMagnitude = Math.abs(headDelta.pitch);
    const rollMagnitude = Math.abs(headDelta.roll);
    const dominant = [
      { axis: 'yaw' as const, magnitude: yawMagnitude, threshold: HEAD_YAW_THRESHOLD },
      { axis: 'pitch' as const, magnitude: pitchMagnitude, threshold: HEAD_PITCH_THRESHOLD },
      { axis: 'roll' as const, magnitude: rollMagnitude, threshold: HEAD_ROLL_THRESHOLD },
    ].sort((a, b) => b.magnitude - a.magnitude)[0];

    if (!dominant || dominant.magnitude < dominant.threshold) {
      return {
        active: false,
        axis: 'none',
        direction: 'CENTER',
        confidence: 0.7,
        delta: 0,
        headDelta,
      };
    }

    return {
      active: true,
      axis: dominant.axis,
      direction: this.headDirection(dominant.axis, headDelta),
      confidence: clamp(
        0.72 + (dominant.magnitude - dominant.threshold) / 35 + (params.faceQuality?.acceptable ? 0.08 : 0),
        0.72,
        0.98,
      ),
      delta: dominant.magnitude,
      headDelta,
    };
  }

  detectEyeDiversion(params: {
    headTurn: HeadTurnSignal | null;
    eyeGaze: EyeGaze | null;
    faceQuality: FaceQuality | null;
    calibration: CalibrationProfile | null;
  }): EyeDiversionSignal | null {
    if (!params.eyeGaze || !params.calibration) return null;

    const eyeDelta = {
      horizontal: params.eyeGaze.horizontalRatio - params.calibration.eyeHorizontalRatio,
      vertical: params.eyeGaze.verticalRatio - params.calibration.eyeVerticalRatio,
    };
    const horizontalMagnitude = Math.abs(eyeDelta.horizontal);
    const verticalMagnitude = Math.abs(eyeDelta.vertical);

    const dominant = horizontalMagnitude >= verticalMagnitude
      ? { axis: 'horizontal' as const, magnitude: horizontalMagnitude, threshold: EYE_HORIZONTAL_THRESHOLD }
      : { axis: 'vertical' as const, magnitude: verticalMagnitude, threshold: EYE_VERTICAL_THRESHOLD };

    if (params.faceQuality?.obstructed || dominant.magnitude < dominant.threshold) {
      return {
        active: false,
        axis: 'none',
        direction: 'CENTER',
        confidence: 0.58,
        delta: 0,
        eyeDelta,
      };
    }

    return {
      active: true,
      axis: dominant.axis,
      direction: this.eyeDirection(dominant.axis, eyeDelta),
      confidence: clamp(params.eyeGaze.confidence * (params.faceQuality?.acceptable ? 0.92 : 0.72), 0.58, 0.9),
      delta: dominant.magnitude,
      eyeDelta,
    };
  }

  private headDirection(axis: 'yaw' | 'pitch' | 'roll', headDelta: HeadPose): GazeDirection {
    if (axis === 'yaw') return headDelta.yaw > 0 ? 'RIGHT' : 'LEFT';
    if (axis === 'pitch') return headDelta.pitch > 0 ? 'DOWN' : 'UP';

    return headDelta.roll > 0 ? 'RIGHT' : 'LEFT';
  }

  private eyeDirection(axis: 'horizontal' | 'vertical', eyeDelta: { horizontal: number; vertical: number }): GazeDirection {
    if (axis === 'horizontal') return eyeDelta.horizontal > 0 ? 'RIGHT' : 'LEFT';

    return eyeDelta.vertical > 0 ? 'DOWN' : 'UP';
  }
}
