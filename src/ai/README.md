# EduGuard AI Proctoring Prototype

This module is browser-only. It does not call the backend, SignalR, REST APIs, authentication, or database code.

## Current Pipeline

Camera at roughly 30 FPS goes through MediaPipe Face Landmarker, then:

1. Face count
2. Face quality
3. Head pose
4. Eye gaze
5. Calibration
6. Temporal smoothing
7. Independent diversion signals
8. Violation engine
9. Local evidence capture

## Detection Philosophy

Head movement and eye movement are intentionally separated.

`HEAD_TURN` is decided from calibrated head pose only. If yaw, pitch, or roll moves beyond the calibrated threshold, the student is treated as looking away by head movement. It is not blocked by face quality, because a strong head turn can naturally reduce one eye's visibility.

`EYE_DIVERSION` is decided from calibrated iris ratios only. It is not blocked by head turn, so the system can log both head movement and eye diversion when both are present. It is blocked only when face quality is truly obstructed.

The system no longer fuses head pose and eye gaze into one final gaze result. This makes the behavior easier to debug and avoids missing cases where a student turns their head or only diverts their eyes.

## Temporal Voting

`HEAD_TURN` and `EYE_DIVERSION` use a 1200ms voting window. `FACE_OBSTRUCTED` uses a 1800ms voting window. The engine does not reset immediately when a few center frames appear between active frames. A violation is emitted when enough frames in the recent window remain active.

This is designed to reduce noisy `LEFT -> CENTER -> LEFT` webcam jitter while still detecting sustained behavior quickly.

## Face Quality

Frames are ignored for gaze decisions when quality is not acceptable. Quality currently considers:

- Face size
- Brightness
- Sharpness
- Eye aspect ratio
- Landmark visibility
- MediaPipe eye blendshape confidence
- Excessive yaw, pitch, and roll

Low-quality frames can emit `FACE_OBSTRUCTED` only when the quality issue is severe or multiple obstruction signals agree. A single low EAR or weak eye blendshape is treated as a quality note, not an obstruction by itself.

## Calibration

The first 2.5 seconds collect a per-user baseline for:

- Head yaw, pitch, roll
- Eye horizontal ratio
- Eye vertical ratio

All head and eye decisions compare current values against this baseline, not against a fixed universal center.
