import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export function midpoint(a: NormalizedLandmark, b: NormalizedLandmark) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

export function distance2d(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleDegrees(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getMatrixData(matrix: unknown): number[] | undefined {
  if (!matrix || typeof matrix !== 'object') return undefined;

  const candidate = matrix as { data?: number[] | Float32Array; getPackedDataList?: () => number[] };

  if (Array.isArray(candidate.data)) return candidate.data;
  if (candidate.data instanceof Float32Array) return Array.from(candidate.data);
  if (typeof candidate.getPackedDataList === 'function') return candidate.getPackedDataList();

  return undefined;
}
