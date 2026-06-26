import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'blocked' | 'error';

export type MediaPipeStatus = 'idle' | 'loading' | 'ready' | 'error';

export type GazeDirection = 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

export type ViolationType = 'ABSENCE' | 'MULTIPLE_FACE' | 'FACE_OBSTRUCTED' | 'HEAD_TURN' | 'EYE_DIVERSION';

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface EyeGaze {
  direction: GazeDirection;
  horizontalRatio: number;
  verticalRatio: number;
  confidence: number;
}

export interface GazeSignal {
  active: boolean;
  direction: GazeDirection;
  confidence: number;
  delta: number;
}

export interface HeadTurnSignal extends GazeSignal {
  axis: 'yaw' | 'pitch' | 'roll' | 'none';
  headDelta: HeadPose;
}

export interface EyeDiversionSignal extends GazeSignal {
  axis: 'horizontal' | 'vertical' | 'none';
  eyeDelta: {
    horizontal: number;
    vertical: number;
  };
}

export interface FaceQuality {
  acceptable: boolean;
  obstructed: boolean;
  score: number;
  faceBoxRatio: number;
  brightness: number;
  sharpness: number;
  leftEyeAspectRatio: number;
  rightEyeAspectRatio: number;
  landmarkVisibility: number;
  blendshapeConfidence: number;
  reasons: string[];
}

export interface CalibrationProfile {
  yaw: number;
  pitch: number;
  roll: number;
  eyeHorizontalRatio: number;
  eyeVerticalRatio: number;
}

export interface CalibrationState {
  status: 'idle' | 'collecting' | 'ready';
  progress: number;
  profile: CalibrationProfile | null;
}

export interface FaceTrackingFrame {
  timestamp: number;
  faceCount: number;
  landmarks: NormalizedLandmark[];
  matrixData?: number[];
  rawResult: FaceLandmarkerResult;
}

export interface ViolationEvent {
  id: string;
  type: ViolationType;
  label: string;
  severity: 'warning' | 'critical';
  emittedAt: number;
  durationMs: number;
  metadata: {
    gaze?: GazeDirection;
    faceCount?: number;
    headPose?: HeadPose;
    faceQuality?: FaceQuality;
    signalConfidence?: number;
  };
}

export interface EvidenceItem {
  id: string;
  violationId: string;
  violationType: ViolationType;
  capturedAt: number;
  imageDataUrl: string;
}

export interface ProctoringFrameAnalysis {
  timestamp: number;
  faceCount: number;
  headPose: HeadPose | null;
  eyeGaze: EyeGaze | null;
  headTurn: HeadTurnSignal | null;
  eyeDiversion: EyeDiversionSignal | null;
  faceQuality: FaceQuality | null;
  calibration: CalibrationState;
  activeSignals: ViolationType[];
}

export interface ViolationEngineThresholds {
  absenceMs: number;
  multipleFaceMs: number;
  faceObstructedMs: number;
  headTurnMs: number;
  eyeDiversionMs: number;
}
