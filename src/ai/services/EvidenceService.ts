import type { EvidenceItem, ViolationEvent } from '../types/proctoring';

export class EvidenceService {
  capture(video: HTMLVideoElement, violation: ViolationEvent): EvidenceItem | null {
    if (!video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return {
      id: `evidence-${violation.id}`,
      violationId: violation.id,
      violationType: violation.type,
      capturedAt: violation.emittedAt,
      imageDataUrl: canvas.toDataURL('image/jpeg', 0.82),
    };
  }
}
