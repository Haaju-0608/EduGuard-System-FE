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
9. Rolling video evidence capture

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

## Rolling Video Evidence

The evidence system uses continuous video buffering, not image snapshots.

Continuous Recording

-> Rolling Buffer (Last 10 Seconds)

-> Violation Trigger

-> Freeze Previous Buffer

-> Continue Recording (5 Seconds)

-> Compose Evidence Clip

-> Upload to FastAPI

The recorder keeps only the latest 10 chunks in memory. Each chunk is approximately one second. When a violation event is emitted, the recorder freezes the pre-event buffer, continues collecting five more seconds, then composes a single `video/webm` evidence clip.

If another violation happens during the five-second post-event period, it is appended as metadata to the same evidence clip. Only one video is produced, but it can contain multiple violation records.

The recorder sets `videoBitsPerSecond` to 800 kbps by default so 15-second clips stay reasonably small while remaining clear enough for manual review.

## Why Video Evidence Instead of Images

The previous implementation captured only a single image when a violation occurred.

This approach had several limitations:

- No context before the violation.
- Impossible to verify whether the student actually looked away.
- Difficult for lecturers to distinguish false positives.
- No temporal evidence.

Rolling video evidence preserves both the events before and after the violation, providing much stronger proof for manual review.

## Evidence Flow

Camera (30 FPS)

-> Continuous Video Buffer

-> Rolling Buffer (last 10s)

-> Violation Engine

-> Freeze Buffer

-> Record +5s

-> Evidence Clip (15s)

-> FastAPI

-> Save

-> ASP.NET API

-> Supabase Storage

If `VITE_FASTAPI_EVIDENCE_URL` is set, the clip is uploaded as `multipart/form-data` with:

- `video`
- `violationType`
- `participationId`
- `sessionId`
- `studentId`
- `timestamp`
- `direction`
- `confidence`
- `duration`
- `metadata`

If no upload URL is configured, the clip stays as a local object URL for frontend testing.

Local object URLs live only in the current browser session. They are useful for prototype review, but they are not files on disk and will be lost after reload or cleanup. Use the Download action to save a clip manually, or configure `VITE_FASTAPI_EVIDENCE_URL` for persistent storage.

## Calibration

The first 2.5 seconds collect a per-user baseline for:

- Head yaw, pitch, roll
- Eye horizontal ratio
- Eye vertical ratio

All head and eye decisions compare current values against this baseline, not against a fixed universal center.
