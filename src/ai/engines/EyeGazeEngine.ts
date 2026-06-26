import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { EyeGaze, GazeDirection } from '../types/proctoring';
import { clamp, midpoint } from '../utils/landmarkGeometry';

const LEFT_EYE = {
  outer: 33,
  inner: 133,
  top: 159,
  bottom: 145,
  iris: 468,
};

const RIGHT_EYE = {
  outer: 263,
  inner: 362,
  top: 386,
  bottom: 374,
  iris: 473,
};

export class EyeGazeEngine {
  estimate(landmarks: NormalizedLandmark[]): EyeGaze | null {
    if (landmarks.length <= RIGHT_EYE.iris) return null;

    const left = this.eyeRatios(landmarks, LEFT_EYE);
    const right = this.eyeRatios(landmarks, RIGHT_EYE);
    const horizontalRatio = (left.horizontal + right.horizontal) / 2;
    const verticalRatio = (left.vertical + right.vertical) / 2;
    const direction = this.resolveDirection(horizontalRatio, verticalRatio);
    const confidence = clamp(
      Math.max(Math.abs(horizontalRatio - 0.5), Math.abs(verticalRatio - 0.5)) * 2.4,
      direction === 'CENTER' ? 0.65 : 0.72,
      0.98,
    );

    return {
      direction,
      horizontalRatio,
      verticalRatio,
      confidence,
    };
  }

  private eyeRatios(landmarks: NormalizedLandmark[], eye: typeof LEFT_EYE) {
    const outer = landmarks[eye.outer];
    const inner = landmarks[eye.inner];
    const top = landmarks[eye.top];
    const bottom = landmarks[eye.bottom];
    const iris = landmarks[eye.iris];
    const center = midpoint(outer, inner);
    const width = Math.max(Math.abs(inner.x - outer.x), 0.001);
    const height = Math.max(Math.abs(bottom.y - top.y), 0.001);

    return {
      horizontal: clamp((iris.x - Math.min(outer.x, inner.x)) / width, 0, 1),
      vertical: clamp((iris.y - (center.y - height / 2)) / height, 0, 1),
    };
  }

  private resolveDirection(horizontalRatio: number, verticalRatio: number): GazeDirection {
    if (horizontalRatio < 0.34) return 'LEFT';
    if (horizontalRatio > 0.66) return 'RIGHT';
    if (verticalRatio < 0.3) return 'UP';
    if (verticalRatio > 0.72) return 'DOWN';

    return 'CENTER';
  }
}
