import type { EyeGaze, HeadPose } from '../types/proctoring';

const DEFAULT_ALPHA = 0.35;

export class TemporalFilterEngine {
  private headPose: HeadPose | null = null;
  private eyeGaze: EyeGaze | null = null;

  smoothHeadPose(value: HeadPose | null): HeadPose | null {
    if (!value) return null;
    if (!this.headPose) {
      this.headPose = value;
      return value;
    }

    this.headPose = {
      yaw: this.ema(this.headPose.yaw, value.yaw),
      pitch: this.ema(this.headPose.pitch, value.pitch),
      roll: this.ema(this.headPose.roll, value.roll),
    };

    return this.headPose;
  }

  smoothEyeGaze(value: EyeGaze | null): EyeGaze | null {
    if (!value) return null;
    if (!this.eyeGaze) {
      this.eyeGaze = value;
      return value;
    }

    this.eyeGaze = {
      ...value,
      horizontalRatio: this.ema(this.eyeGaze.horizontalRatio, value.horizontalRatio),
      verticalRatio: this.ema(this.eyeGaze.verticalRatio, value.verticalRatio),
      confidence: this.ema(this.eyeGaze.confidence, value.confidence),
    };

    return this.eyeGaze;
  }

  reset() {
    this.headPose = null;
    this.eyeGaze = null;
  }

  private ema(previous: number, next: number) {
    return previous * (1 - DEFAULT_ALPHA) + next * DEFAULT_ALPHA;
  }

}
