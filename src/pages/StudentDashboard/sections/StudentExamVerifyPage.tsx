import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiRefreshCw,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchMyApprovedBiometricPhoto } from '../../../services/schoolAdminApi';
import { MediaPipeFaceLandmarkerService } from '../../../ai/services/MediaPipeFaceLandmarkerService';
import { computeFaceSimilarity, extractLandmarksFromImage, type LandmarkSet } from '../../../ai/services/FaceVerificationService';

// Điểm tương đồng tối thiểu (0-1) để tính 1 frame là khớp mặt — tăng từ 0.55 lên 0.72 sau khi phát
// hiện ngưỡng cũ + thuật toán cũ (10 điểm mốc) để lọt người khác mặt vẫn "Identity Verified" được.
// Cần test lại với người thật: nếu người đúng cũng bị từ chối liên tục, hạ dần xuống; nếu người khác
// vẫn lọt qua được, tăng thêm.
const SIMILARITY_THRESHOLD = 0.72;
// Số frame liên tiếp đạt yêu cầu để xác nhận verify thành công (~2s ở 30fps)
const VERIFY_FRAMES_NEEDED = 60;
// Quá thời gian này mà chưa verify được thì dừng lại báo lỗi, tránh treo "Verifying…" vô thời hạn
const SCAN_TIMEOUT_MS = 25_000;

type VerifyStep = 'loading' | 'no-biometric' | 'idle' | 'starting' | 'scanning' | 'verified' | 'failed';

export default function StudentExamVerifyPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const refLandmarksRef = useRef<LandmarkSet | null>(null);
  const goodFramesRef = useRef(0);

  const [step, setStep] = useState<VerifyStep>('loading');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState(0);
  const [referencePhotoUrl, setReferencePhotoUrl] = useState<string | null>(null);
  const [hasRefPhoto, setHasRefPhoto] = useState(false);

  const exam = (() => {
    try { return JSON.parse(localStorage.getItem(`studentExam_${examId}`) ?? '{}'); } catch { return {}; }
  })();

  // Lấy ảnh sinh trắc học đã được SchoolAdmin duyệt của sinh viên khi component mount — bắt buộc
  // phải có ảnh đã approve mới cho vào thi (fail closed), không còn bypass bằng face-presence-only
  // như lúc BE chưa nối AI trích vector nữa (pipeline approve biometric giờ đã hoạt động thật).
  useEffect(() => {
    if (!user?.id) return;
    fetchMyApprovedBiometricPhoto(user.id)
      .then((url) => {
        if (url) {
          setReferencePhotoUrl(url);
          setHasRefPhoto(true);
          setStep('idle');
        } else {
          setHasRefPhoto(false);
          setStep('no-biometric');
        }
      })
      .catch(() => {
        setHasRefPhoto(false);
        setStep('no-biometric');
      });
  }, [user?.id]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setStep('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Khởi tạo landmarker chế độ VIDEO trước, XONG mới trích landmark chế độ IMAGE từ ảnh đã lưu —
      // chạy tuần tự (không Promise.all) vì 2 lần khởi tạo FaceLandmarker (WASM + GPU delegate) cùng
      // lúc dễ tranh chấp tài nguyên GPU/WebGL khiến lần khởi tạo IMAGE mode fail âm thầm.
      const svc = MediaPipeFaceLandmarkerService.getInstance();
      await svc.initialize();
      const refLandmarks = referencePhotoUrl ? await extractLandmarksFromImage(referencePhotoUrl) : null;

      // Fail closed: nếu có ảnh đăng ký nhưng không trích được landmark (lỗi CORS/GPU/model...),
      // KHÔNG được coi như khớp mặt mặc định — trước đây lỡ để `score = 1` ở nhánh này khiến bất kỳ
      // ai đứng trước cam cũng "Identity Verified" được, bỏ qua hoàn toàn bước xác minh danh tính.
      if (hasRefPhoto && !refLandmarks) {
        setCameraError('Could not verify against your registered photo. Please retry, or contact your administrator if this keeps happening.');
        setStep('failed');
        return;
      }

      refLandmarksRef.current = refLandmarks;
      goodFramesRef.current = 0;
      setSimilarity(0);
      setStep('scanning');
    } catch {
      setCameraError('Cannot access camera. Please allow camera permission and try again.');
      setStep('failed');
    }
  }, [referencePhotoUrl, hasRefPhoto]);

  // Vòng lặp nhận diện / so sánh khuôn mặt
  useEffect(() => {
    if (step !== 'scanning') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const svc = MediaPipeFaceLandmarkerService.getInstance();

    const detect = () => {
      const video = videoRef.current;
      if (!video) return;

      const result = svc.detectForVideo(video, performance.now());
      const liveLandmarks = result?.faceLandmarks?.[0];

      if (liveLandmarks && video.videoWidth && video.videoHeight) {
        // Fail closed: startCamera() đã chặn không cho vào 'scanning' nếu refLandmarksRef rỗng trong
        // khi có ảnh đăng ký — nhánh else ở đây chỉ còn là an toàn dự phòng, không được coi là khớp.
        const liveSet: LandmarkSet = { landmarks: liveLandmarks, width: video.videoWidth, height: video.videoHeight };
        const score = refLandmarksRef.current
          ? computeFaceSimilarity(refLandmarksRef.current, liveSet)
          : 0;

        setSimilarity(score);

        if (score >= SIMILARITY_THRESHOLD) {
          goodFramesRef.current += 1;
          if (goodFramesRef.current >= VERIFY_FRAMES_NEEDED) {
            setStep('verified');
            return;
          }
        } else {
          goodFramesRef.current = Math.max(0, goodFramesRef.current - 2);
        }
      } else {
        goodFramesRef.current = 0;
        setSimilarity(0);
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step]);

  // Timeout cho bước quét — không verify được trong SCAN_TIMEOUT_MS thì dừng và báo lỗi rõ ràng,
  // thay vì để "Verifying…" treo vô thời hạn khi điểm khớp không bao giờ đạt ngưỡng.
  useEffect(() => {
    if (step !== 'scanning') return;
    const timer = setTimeout(() => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraError('Could not verify your identity in time. Please ensure good lighting, face the camera directly, and try again.');
      setStep('failed');
    }, SCAN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [step]);

  // Dọn dẹp khi component unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopAndRetry = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setSimilarity(0);
    goodFramesRef.current = 0;
    startCamera();
  };

  const stepIdx =
    step === 'idle' || step === 'starting' ? 0
    : step === 'scanning' ? 1
    : step === 'verified' ? 2
    : 0;

  const similarityPct = Math.round(similarity * 100);
  const aboveThreshold = similarity >= SIMILARITY_THRESHOLD;

  return (
    <div className="h-screen overflow-hidden bg-navy flex flex-col">
      {/* Thanh trên cùng */}
      <div className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-border bg-navy-card">
        <button
          onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); navigate(-1); }}
          className="flex items-center gap-2 text-muted text-sm hover:text-white-soft transition-colors cursor-pointer bg-transparent border-none"
        >
          <FiArrowLeft /> Back
        </button>
        <div className="text-center">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Identity Verification</p>
          <p className="font-syne font-bold text-white-soft text-sm">{exam.examName ?? 'Exam'}</p>
        </div>
        <div className="w-16" />
      </div>

      {/* Nội dung: 2 cột */}
      <div className="flex-1 flex overflow-hidden">

        {/* Bên trái — Camera */}
        <div className="flex-1 flex items-center justify-center bg-navy/50 p-8">
          <div className="relative w-full max-w-75">
            {/* Hiệu ứng phát sáng nền */}
            <div className={`absolute inset-0 rounded-[28px] blur-2xl transition-all duration-700 pointer-events-none ${
              step === 'verified' ? 'bg-green/25'
              : step === 'scanning' ? 'bg-blue/20'
              : 'bg-transparent'
            }`} />

            {/* Khung camera — tỉ lệ 4:5 */}
            <div className={`relative w-full aspect-4/5 rounded-[20px] overflow-hidden border-2 transition-all duration-500 ${
              step === 'verified' ? 'border-green shadow-[0_0_40px_rgba(34,197,94,0.25)]'
              : step === 'scanning' ? 'border-blue-bright shadow-[0_0_30px_rgba(99,179,237,0.2)]'
              : 'border-border'
            }`}>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                muted playsInline autoPlay
              />

              {/* Đang tải */}
              {step === 'loading' && (
                <div className="absolute inset-0 bg-navy/80">
                  {/* Spinner căn giữa tuyệt đối theo khung camera, tách riêng khỏi chữ bên dưới
                      để không bị đẩy lệch tâm khi flex-col + gap canh cả nhóm làm 1 khối */}
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="w-10 h-10 border-2 border-blue-bright/30 border-t-blue-bright rounded-full animate-spin" />
                  </div>
                  <p className="absolute left-1/2 -translate-x-1/2 top-[58%] text-sm text-muted whitespace-nowrap">Loading…</p>
                </div>
              )}

              {/* Chưa có sinh trắc học / Chờ */}
              {(step === 'idle' || step === 'no-biometric') && (
                <div className="absolute inset-0 bg-navy/80 flex flex-col items-center justify-center gap-3">
                  <FiCamera className="text-4xl text-muted" />
                  <p className="text-sm text-muted">Camera not started</p>
                </div>
              )}

              {/* Đang khởi động camera */}
              {step === 'starting' && (
                <div className="absolute inset-0 bg-navy/80">
                  {/* Spinner căn giữa tuyệt đối theo khung camera, tách riêng khỏi chữ bên dưới
                      để không bị đẩy lệch tâm khi flex-col + gap canh cả nhóm làm 1 khối */}
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="w-10 h-10 border-2 border-blue-bright/30 border-t-blue-bright rounded-full animate-spin" />
                  </div>
                  <p className="absolute left-1/2 -translate-x-1/2 top-[58%] text-sm text-muted whitespace-nowrap">Accessing camera…</p>
                </div>
              )}

              {/* Lớp phủ đang quét */}
              {step === 'scanning' && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`w-[55%] h-[70%] rounded-full border-2 transition-colors duration-300 ${
                      aboveThreshold
                        ? 'border-green/80 shadow-[0_0_20px_rgba(34,197,94,0.35)]'
                        : 'border-blue-bright/70 shadow-[0_0_20px_rgba(99,179,237,0.4)]'
                    }`} />
                  </div>
                  {/* Dấu ở 4 góc */}
                  {(['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2', 'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'] as const).map((cls, i) => (
                    <div key={i} className={`absolute w-4 h-4 border-blue-bright ${cls}`} />
                  ))}
                </>
              )}

              {/* Đã xác minh */}
              {step === 'verified' && (
                <div className="absolute inset-0 bg-green/10 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-green/20 border-2 border-green grid place-items-center shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                    <FiCheck className="text-green text-2xl" />
                  </div>
                  <p className="font-bold text-green text-sm">Identity Verified</p>
                </div>
              )}

              {/* Thất bại */}
              {step === 'failed' && (
                <div className="absolute inset-0 bg-navy/80 flex flex-col items-center justify-center gap-3 px-6">
                  <FiAlertCircle className="text-red text-3xl shrink-0" />
                  <p className="text-red text-sm font-semibold text-center">{cameraError}</p>
                </div>
              )}
            </div>

            {/* Thanh độ tin cậy khớp mặt */}
            {step === 'scanning' && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-muted">
                  <span>{hasRefPhoto ? 'Match confidence' : 'Face detected'}</span>
                  <span className={aboveThreshold ? 'text-green font-semibold' : ''}>{similarityPct}%</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${similarityPct}%`,
                      background: aboveThreshold
                        ? '#22c55e'
                        : 'linear-gradient(to right, #2b6cb0, #63b3ed)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bên phải — Panel thông tin */}
        <div className="w-85 shrink-0 border-l border-border bg-navy-card flex flex-col justify-between p-8 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">

            {/* Các bước */}
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-4">Verification Steps</p>
              <div className="space-y-3">
                {(['Allow Camera', 'Scan Your Face', 'Ready to Start'] as const).map((label, i) => {
                  const done = i < stepIdx;
                  const active = i === stepIdx;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full border-2 grid place-items-center text-xs font-bold shrink-0 transition-all ${
                        done ? 'bg-green border-green text-white'
                        : active ? 'border-blue-bright text-blue-bright'
                        : 'border-border text-muted'
                      }`}>
                        {done ? <FiCheck className="text-xs" /> : i + 1}
                      </div>
                      <p className={`text-sm font-semibold transition-colors ${
                        done ? 'text-green' : active ? 'text-white-soft' : 'text-muted'
                      }`}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Thông báo trạng thái */}
            <div className={`rounded-xl px-4 py-3 border text-sm transition-all ${
              step === 'verified' ? 'bg-green/10 border-green/30 text-green'
              : step === 'scanning' ? 'bg-blue/10 border-blue-bright/30 text-blue-bright'
              : step === 'failed' ? 'bg-red/10 border-red/30 text-red'
              : step === 'no-biometric' ? 'bg-gold/10 border-gold/30 text-gold'
              : 'bg-navy border-border text-muted'
            }`}>
              {step === 'loading' && 'Loading your biometric profile…'}
              {step === 'no-biometric' && 'No approved biometric photo found. Please register your face first or contact your administrator.'}
              {step === 'idle' && (hasRefPhoto
                ? 'Click below to start camera and verify your identity.'
                : 'No biometric on file — face presence check only.')}
              {step === 'starting' && 'Opening camera, please wait…'}
              {step === 'scanning' && (hasRefPhoto
                ? 'Look directly at the camera and keep still.'
                : 'Face detected — hold still to verify.')}
              {step === 'verified' && 'Identity verified! You can now start the exam.'}
              {step === 'failed' && (cameraError ?? 'Verification failed. Please retry.')}
            </div>

            {/* Ảnh thu nhỏ ảnh tham chiếu */}
            {referencePhotoUrl && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiUser className="text-muted text-xs" />
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Registered Photo</p>
                </div>
                <img
                  src={referencePhotoUrl}
                  alt="Registered biometric"
                  className="w-full rounded-xl object-cover aspect-4/5 opacity-60 border border-border"
                />
              </div>
            )}

            {/* Lưu ý */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <FiShield className="text-gold text-sm" />
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Before You Start</p>
              </div>
              {[
                'Ensure your face is well lit and clearly visible',
                'Do not wear sunglasses or hats during the exam',
                'Your camera will be active throughout the exam',
                'Suspicious activity may result in disqualification',
              ].map((rule) => (
                <div key={rule} className="flex items-start gap-2 text-xs text-muted">
                  <span className="text-gold mt-0.5 shrink-0">•</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Nút hành động — ghim ở dưới cùng */}
          <div className="pt-6">
            {step === 'loading' && (
              <div className="w-full py-3 rounded-xl border border-border text-muted text-sm text-center opacity-50">
                Loading…
              </div>
            )}
            {step === 'no-biometric' && (
              <button
                onClick={() => navigate(-1)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 font-semibold cursor-pointer transition-colors text-sm"
              >
                <FiArrowLeft /> Go Back
              </button>
            )}
            {(step === 'idle' || step === 'failed') && (
              <button
                onClick={step === 'failed' ? stopAndRetry : startCamera}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold cursor-pointer transition-colors border text-sm ${
                  step === 'failed'
                    ? 'bg-gold/10 border-gold/30 text-gold hover:bg-gold/20'
                    : 'bg-blue border-blue text-white hover:bg-blue/80 border-none'
                }`}
              >
                {step === 'failed'
                  ? <><FiRefreshCw /> Retry</>
                  : <><FiCamera /> Start Camera Verification</>}
              </button>
            )}
            {step === 'verified' && (
              <button
                onClick={() => navigate(`/student/exams/${examId}/take`)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green text-white font-bold cursor-pointer hover:bg-green/80 transition-colors border-none text-sm shadow-[0_0_20px_rgba(34,197,94,0.3)]"
              >
                <FiCheck /> Start Exam Now
              </button>
            )}
            {(step === 'starting' || step === 'scanning') && (
              <div className="w-full py-3 rounded-xl border border-border text-muted text-sm text-center opacity-50">
                {step === 'starting' ? 'Opening camera…' : 'Verifying…'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
