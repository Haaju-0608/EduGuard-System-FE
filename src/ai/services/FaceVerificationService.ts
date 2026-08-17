/**
 * Chụp 1 frame hiện tại của <video> camera thành JPEG Blob — dùng để gửi lên BE làm `liveCapture`
 * cho việc verify khuôn mặt server-side qua AI service thật (duy nhất nguồn quyết định khớp danh
 * tính). readyState < 2 (HAVE_CURRENT_DATA) hoặc chưa có videoWidth nghĩa là stream chưa có frame
 * thật nào — trả null, đừng chụp ảnh đen.
 */
export async function captureLiveFrame(video: HTMLVideoElement | null): Promise<Blob | null> {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9));
}
