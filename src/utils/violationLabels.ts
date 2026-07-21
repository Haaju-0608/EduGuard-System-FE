/** Nhãn + icon hiển thị cho từng loại vi phạm — dùng chung giữa Dashboard và trang Violations. */
export const VIOLATION_LABELS: Record<string, { label: string; icon: string }> = {
  GazeDiversion:  { label: 'Gaze Diversion',  icon: '👁' },
  HeadTurn:       { label: 'Head Turn',       icon: '↩️' },
  MultipleFaces:  { label: 'Multiple Faces',  icon: '👥' },
  Absence:        { label: 'Absence',         icon: '🚫' },
  FaceObstructed: { label: 'Face Obstructed', icon: '🙈' },
  Impersonation:  { label: 'Impersonation',   icon: '🎭' },
  TabSwitch:      { label: 'Tab Switch',      icon: '🔀' },
  WindowBlur:     { label: 'Window Blur',     icon: '🪟' },
  ExitFullscreen: { label: 'Exit Fullscreen', icon: '⛶' },
};

export function getViolationLabel(type: string) {
  return VIOLATION_LABELS[type] ?? { label: type, icon: '⚠️' };
}
