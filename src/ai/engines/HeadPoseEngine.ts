import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { HeadPose } from '../types/proctoring';
import { angleDegrees, clamp, distance2d, midpoint } from '../utils/landmarkGeometry';

const LANDMARKS = {
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  noseTip: 1,
  chin: 152,
  forehead: 10,
};

export class HeadPoseEngine {
  estimate(landmarks: NormalizedLandmark[], matrixData?: number[]): HeadPose | null {
    if (landmarks.length < 468) return null;

    if (matrixData && matrixData.length >= 11) {
      return this.fromTransformationMatrix(matrixData);
    }

    return this.fromLandmarks(landmarks);
  }

  private fromTransformationMatrix(matrix: number[]): HeadPose {
    const m00 = matrix[0];
    const m01 = matrix[1];
    const m02 = matrix[2];
    const m10 = matrix[4];
    const m11 = matrix[5];
    const m12 = matrix[6];
    const m20 = matrix[8];
    const m21 = matrix[9];
    const m22 = matrix[10];

    const pitch = Math.atan2(-m21, Math.sqrt(m20 * m20 + m22 * m22)) * (180 / Math.PI);
    const yaw = Math.atan2(m20, m22) * (180 / Math.PI);
    const roll = Math.atan2(m01, m11) * (180 / Math.PI);

    return {
      yaw: clamp(yaw, -90, 90),
      pitch: clamp(pitch, -90, 90),
      roll: clamp(roll, -90, 90),
    };
  }

  private fromLandmarks(landmarks: NormalizedLandmark[]): HeadPose {
    const leftEye = landmarks[LANDMARKS.leftEyeOuter];
    const rightEye = landmarks[LANDMARKS.rightEyeOuter];
    const nose = landmarks[LANDMARKS.noseTip];
    const chin = landmarks[LANDMARKS.chin];
    const forehead = landmarks[LANDMARKS.forehead];
    const eyeCenter = midpoint(leftEye, rightEye);
    const faceWidth = Math.max(distance2d(leftEye, rightEye), 0.001);
    const faceHeight = Math.max(distance2d(forehead, chin), 0.001);

    const yaw = ((nose.x - eyeCenter.x) / faceWidth) * 70;
    const pitch = ((nose.y - eyeCenter.y) / faceHeight - 0.18) * 120;
    const roll = angleDegrees(leftEye, rightEye);

    return {
      yaw: clamp(yaw, -60, 60),
      pitch: clamp(pitch, -60, 60),
      roll: clamp(roll, -45, 45),
    };
  }
}
