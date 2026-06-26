import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { FaceQuality, HeadPose } from '../types/proctoring';
import { clamp, distance2d } from '../utils/landmarkGeometry';

const LEFT_EYE = {
  outer: 33,
  inner: 133,
  top: 159,
  bottom: 145,
};

const RIGHT_EYE = {
  outer: 263,
  inner: 362,
  top: 386,
  bottom: 374,
};

const MIN_FACE_BOX_RATIO = 0.035;
const MIN_EYE_ASPECT_RATIO = 0.075;
const MIN_BRIGHTNESS = 35;
const MAX_BRIGHTNESS = 225;
const MIN_SHARPNESS = 8;
const MAX_ABS_ROLL = 28;
const MAX_ABS_YAW = 38;
const MAX_ABS_PITCH = 32;
const IGNORE_EAR_WHEN_YAW_OVER = 20;
const IGNORE_EAR_WHEN_PITCH_OVER = 18;
const SAMPLE_SIZE = 48;

export class FaceQualityEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  estimate(params: {
    video: HTMLVideoElement;
    landmarks: NormalizedLandmark[];
    headPose: HeadPose | null;
    blendshapes?: Classifications;
  }): FaceQuality | null {
    if (params.landmarks.length < 468 || !params.video.videoWidth || !params.video.videoHeight) {
      return null;
    }

    const faceBox = this.faceBox(params.landmarks);
    const faceBoxRatio = faceBox.width * faceBox.height;
    const leftEyeAspectRatio = this.eyeAspectRatio(params.landmarks, LEFT_EYE);
    const rightEyeAspectRatio = this.eyeAspectRatio(params.landmarks, RIGHT_EYE);
    const landmarkVisibility = this.landmarkVisibility(params.landmarks);
    const imageStats = this.imageStats(params.video, faceBox);
    const blendshapeConfidence = this.blendshapeConfidence(params.blendshapes);
    const reasons: string[] = [];
    const poseYaw = Math.abs(params.headPose?.yaw ?? 0);
    const posePitch = Math.abs(params.headPose?.pitch ?? 0);
    const shouldTrustEar = poseYaw <= IGNORE_EAR_WHEN_YAW_OVER && posePitch <= IGNORE_EAR_WHEN_PITCH_OVER;

    if (faceBoxRatio < MIN_FACE_BOX_RATIO) reasons.push('FACE_TOO_SMALL');
    if (imageStats.brightness < MIN_BRIGHTNESS) reasons.push('TOO_DARK');
    if (imageStats.brightness > MAX_BRIGHTNESS) reasons.push('TOO_BRIGHT');
    if (imageStats.sharpness < MIN_SHARPNESS) reasons.push('BLURRY');
    if (shouldTrustEar && (leftEyeAspectRatio < MIN_EYE_ASPECT_RATIO || rightEyeAspectRatio < MIN_EYE_ASPECT_RATIO)) {
      reasons.push('EYE_OCCLUDED_OR_CLOSED');
    }
    if (landmarkVisibility < 0.55) reasons.push('LOW_LANDMARK_VISIBILITY');
    if (blendshapeConfidence < 0.25) reasons.push('LOW_EYE_BLENDSHAPE_CONFIDENCE');
    if (params.headPose && Math.abs(params.headPose.roll) > MAX_ABS_ROLL) reasons.push('FACE_ROLL_TOO_HIGH');
    if (params.headPose && Math.abs(params.headPose.yaw) > MAX_ABS_YAW) reasons.push('FACE_YAW_TOO_HIGH');
    if (params.headPose && Math.abs(params.headPose.pitch) > MAX_ABS_PITCH) reasons.push('FACE_PITCH_TOO_HIGH');

    const score = clamp(
      1
        - reasons.length * 0.15
        + clamp((faceBoxRatio - MIN_FACE_BOX_RATIO) * 4, 0, 0.18)
        + clamp((Math.min(leftEyeAspectRatio, rightEyeAspectRatio) - MIN_EYE_ASPECT_RATIO) * 1.2, 0, 0.12)
        + clamp((imageStats.sharpness - MIN_SHARPNESS) / 120, 0, 0.12),
      0,
      1,
    );
    const severeImageIssue = reasons.includes('FACE_TOO_SMALL') || reasons.includes('TOO_DARK') || reasons.includes('TOO_BRIGHT');
    const obstructionReasonCount = reasons.filter((reason) => (
      reason === 'EYE_OCCLUDED_OR_CLOSED'
      || reason === 'LOW_LANDMARK_VISIBILITY'
      || reason === 'LOW_EYE_BLENDSHAPE_CONFIDENCE'
      || reason === 'BLURRY'
    )).length;
    const obstructed = severeImageIssue || (obstructionReasonCount >= 2 && score < 0.72);

    return {
      acceptable: score >= 0.65 && !severeImageIssue,
      obstructed,
      score,
      faceBoxRatio,
      brightness: imageStats.brightness,
      sharpness: imageStats.sharpness,
      leftEyeAspectRatio,
      rightEyeAspectRatio,
      landmarkVisibility,
      blendshapeConfidence,
      reasons,
    };
  }

  private eyeAspectRatio(landmarks: NormalizedLandmark[], eye: typeof LEFT_EYE) {
    const width = Math.max(distance2d(landmarks[eye.outer], landmarks[eye.inner]), 0.001);
    const height = distance2d(landmarks[eye.top], landmarks[eye.bottom]);

    return height / width;
  }

  private landmarkVisibility(landmarks: NormalizedLandmark[]) {
    const values = landmarks
      .map((landmark) => landmark.visibility)
      .filter((visibility) => typeof visibility === 'number' && Number.isFinite(visibility));

    if (values.length === 0) return 1;

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private faceBox(landmarks: NormalizedLandmark[]) {
    const xs = landmarks.map((landmark) => landmark.x);
    const ys = landmarks.map((landmark) => landmark.y);
    const minX = clamp(Math.min(...xs), 0, 1);
    const minY = clamp(Math.min(...ys), 0, 1);
    const maxX = clamp(Math.max(...xs), 0, 1);
    const maxY = clamp(Math.max(...ys), 0, 1);

    return {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 0.001),
      height: Math.max(maxY - minY, 0.001),
    };
  }

  private imageStats(video: HTMLVideoElement, box: { x: number; y: number; width: number; height: number }) {
    const ctx = this.getContext();

    if (!ctx) {
      return { brightness: 128, sharpness: 100 };
    }

    ctx.drawImage(
      video,
      box.x * video.videoWidth,
      box.y * video.videoHeight,
      box.width * video.videoWidth,
      box.height * video.videoHeight,
      0,
      0,
      SAMPLE_SIZE,
      SAMPLE_SIZE,
    );

    const data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    const grays: number[] = [];
    let brightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      grays.push(gray);
      brightness += gray;
    }

    brightness /= grays.length;

    let gradientSum = 0;
    let gradientCount = 0;
    for (let y = 1; y < SAMPLE_SIZE - 1; y += 1) {
      for (let x = 1; x < SAMPLE_SIZE - 1; x += 1) {
        const index = y * SAMPLE_SIZE + x;
        const gx = grays[index + 1] - grays[index - 1];
        const gy = grays[index + SAMPLE_SIZE] - grays[index - SAMPLE_SIZE];
        gradientSum += Math.abs(gx) + Math.abs(gy);
        gradientCount += 1;
      }
    }

    return {
      brightness,
      sharpness: gradientCount > 0 ? gradientSum / gradientCount : 0,
    };
  }

  private blendshapeConfidence(blendshapes?: Classifications) {
    const categories = blendshapes?.categories ?? [];
    const eyeCategories = categories.filter((category) => {
      const name = category.categoryName.toLowerCase();
      return name.includes('eyeblink') || name.includes('eyesquint') || name.includes('eyelook');
    });

    if (eyeCategories.length === 0) return 1;

    const blinkScores = eyeCategories
      .filter((category) => category.categoryName.toLowerCase().includes('eyeblink'))
      .map((category) => category.score);

    if (blinkScores.length === 0) return 1;

    const maxBlink = Math.max(...blinkScores);
    return clamp(1 - maxBlink, 0, 1);
  }

  private getContext() {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = SAMPLE_SIZE;
      this.canvas.height = SAMPLE_SIZE;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    return this.ctx;
  }
}
