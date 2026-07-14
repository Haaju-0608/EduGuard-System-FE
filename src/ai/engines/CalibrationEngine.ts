import type { CalibrationProfile, CalibrationState, EyeGaze, FaceQuality, HeadPose } from '../types/proctoring';
import { clamp } from '../utils/landmarkGeometry';

const CALIBRATION_MS = 2500;
const MIN_SAMPLES = 20;

export class CalibrationEngine {
  private startedAt: number | null = null;
  private samples: CalibrationProfile[] = [];
  private profile: CalibrationProfile | null = null;

  start(timestamp: number) {
    this.startedAt = timestamp;
    this.samples = [];
    this.profile = null;
  }

  update(params: {
    timestamp: number;
    headPose: HeadPose | null;
    eyeGaze: EyeGaze | null;
    faceQuality: FaceQuality | null;
  }): CalibrationState {
    if (!this.startedAt) {
      this.start(params.timestamp);
    }

    if (this.profile) {
      return { status: 'ready', progress: 1, profile: this.profile };
    }

    if (params.headPose && params.eyeGaze && params.faceQuality?.acceptable) {
      this.samples.push({
        yaw: params.headPose.yaw,
        pitch: params.headPose.pitch,
        roll: params.headPose.roll,
        eyeHorizontalRatio: params.eyeGaze.horizontalRatio,
        eyeVerticalRatio: params.eyeGaze.verticalRatio,
      });
    }

    const elapsed = params.timestamp - (this.startedAt ?? params.timestamp);
    const progress = clamp(elapsed / CALIBRATION_MS, 0, 1);

    if (progress >= 1 && this.samples.length >= MIN_SAMPLES) {
      this.profile = this.averageProfile();
      return { status: 'ready', progress: 1, profile: this.profile };
    }

    return { status: 'collecting', progress, profile: null };
  }

  getState(): CalibrationState {
    if (this.profile) return { status: 'ready', progress: 1, profile: this.profile };
    return { status: this.startedAt ? 'collecting' : 'idle', progress: 0, profile: null };
  }

  reset() {
    this.startedAt = null;
    this.samples = [];
    this.profile = null;
  }

  private averageProfile(): CalibrationProfile {
    const total = this.samples.reduce(
      (sum, sample) => ({
        yaw: sum.yaw + sample.yaw,
        pitch: sum.pitch + sample.pitch,
        roll: sum.roll + sample.roll,
        eyeHorizontalRatio: sum.eyeHorizontalRatio + sample.eyeHorizontalRatio,
        eyeVerticalRatio: sum.eyeVerticalRatio + sample.eyeVerticalRatio,
      }),
      { yaw: 0, pitch: 0, roll: 0, eyeHorizontalRatio: 0, eyeVerticalRatio: 0 },
    );

    return {
      yaw: total.yaw / this.samples.length,
      pitch: total.pitch / this.samples.length,
      roll: total.roll / this.samples.length,
      eyeHorizontalRatio: total.eyeHorizontalRatio / this.samples.length,
      eyeVerticalRatio: total.eyeVerticalRatio / this.samples.length,
    };
  }
}
