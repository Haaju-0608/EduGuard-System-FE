import React, { useState } from 'react';
import { FiCheckCircle, FiXCircle, FiUserCheck, FiClipboard, FiInbox, FiTrendingUp, FiMessageSquare } from 'react-icons/fi';

interface ApprovalRequest {
  id: string;
  studentId: string;
  name: string;
  dept: string;
  reason: string;
  date: string;
  aiScore: number;
  originalAvatar: string;
  newAvatar: string;
}

const initialRequests: ApprovalRequest[] = [
  {
    id: 'REQ-881',
    studentId: 'SV820493',
    name: 'Pham Duc',
    dept: 'IT',
    reason: 'Webcam lighting error during exam check-in. Template rebuild request.',
    date: 'June 07, 2026 14:10',
    aiScore: 71.4,
    originalAvatar: 'PD',
    newAvatar: 'PD',
  },
  {
    id: 'REQ-882',
    studentId: 'SV820494',
    name: 'Bui Kim',
    dept: 'CS',
    reason: 'Registered a low resolution webcam photo. Requesting clear biometric reload.',
    date: 'June 06, 2026 11:32',
    aiScore: 62.1,
    originalAvatar: 'BK',
    newAvatar: 'BK',
  },
  {
    id: 'REQ-883',
    studentId: 'SV820499',
    name: 'Nguyen Lan',
    dept: 'Business',
    reason: 'Changed eyeglasses frame. Facial landmarks failing authentication.',
    date: 'June 05, 2026 09:15',
    aiScore: 81.6,
    originalAvatar: 'NL',
    newAvatar: 'NL',
  },
];

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>(initialRequests);
  const [selectedId, setSelectedId] = useState<string | null>(initialRequests[0]?.id || null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeReq = requests.find((r) => r.id === selectedId) || requests[0] || null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApprove = (id: string, name: string) => {
    setRequests(requests.filter((r) => r.id !== id));
    showToast(`Approved face biometric registration for ${name}`);
    setShowRejectForm(false);
    setRejectFeedback('');
    // auto select next
    const remaining = requests.filter((r) => r.id !== id);
    if (remaining.length > 0) {
      setSelectedId(remaining[0].id);
    } else {
      setSelectedId(null);
    }
  };

  const handleReject = (id: string, name: string) => {
    if (!rejectFeedback.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setRequests(requests.filter((r) => r.id !== id));
    showToast(`Rejected biometric request for ${name}. Feedback sent.`);
    setShowRejectForm(false);
    setRejectFeedback('');
    // auto select next
    const remaining = requests.filter((r) => r.id !== id);
    if (remaining.length > 0) {
      setSelectedId(remaining[0].id);
    } else {
      setSelectedId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-navy-mid border border-cyan/50 text-white-soft px-4 py-3 rounded-xl shadow-[0_8px_32px_rgba(6,182,212,0.15)] animate-fade-slide-in font-dm text-sm">
          <FiCheckCircle className="text-cyan text-lg flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-syne font-extrabold text-2xl text-white-soft flex items-center gap-2">
          <FiUserCheck className="text-cyan" />
          Administrative Approvals
        </h1>
        <p className="text-muted font-dm text-sm mt-1">
          Review, approve, or reject student requests to rebuild or override biometric face templates.
        </p>
      </div>

      {requests.length > 0 && activeReq ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left panel: list of requests (2/5) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-syne font-bold text-white-soft text-base">
              Pending Requests ({requests.length})
            </h3>
            
            <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
              {requests.map((req) => {
                const isActive = req.id === selectedId;
                return (
                  <div
                    key={req.id}
                    onClick={() => {
                      setSelectedId(req.id);
                      setShowRejectForm(false);
                    }}
                    className={`p-4 rounded-xl border text-sm font-dm cursor-pointer transition-all ${
                      isActive
                        ? 'border-cyan bg-cyan/5 text-white-soft shadow-md'
                        : 'border-border/60 bg-navy-card/60 hover:bg-navy-mid text-muted'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-[10px] text-muted">{req.id}</span>
                      <span className="text-[10px] text-cyan bg-cyan/10 border border-cyan/25 px-1.5 py-0.2 rounded-full">
                        AI Match: {req.aiScore}%
                      </span>
                    </div>
                    <p className={`font-semibold ${isActive ? 'text-cyan' : 'text-white-soft'}`}>{req.name}</p>
                    <p className="text-xs mt-1 text-muted line-clamp-1">{req.reason}</p>
                    <p className="text-[10px] mt-2 text-muted/80">{req.date}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel: Side-by-side details (3/5) */}
          <div className="lg:col-span-3 bg-navy-card border border-border rounded-2xl p-5 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs text-muted">Ticket: {activeReq.id}</span>
                <span className="text-xs text-muted">{activeReq.date}</span>
              </div>
              <h3 className="font-syne font-extrabold text-white-soft text-lg">{activeReq.name}</h3>
              <p className="text-xs text-muted font-dm">
                Student ID: <span className="font-mono text-white-soft">{activeReq.studentId}</span> • Dept: {activeReq.dept}
              </p>
            </div>

            {/* Reason details */}
            <div className="bg-navy/55 border border-border/50 rounded-xl p-4 font-dm text-sm text-muted">
              <p className="font-semibold text-white-soft mb-1 flex items-center gap-1.5">
                <FiClipboard className="text-cyan" />
                Reason for template update request:
              </p>
              <p className="italic leading-relaxed">{activeReq.reason}</p>
            </div>

            {/* Side-by-side Biometric Comparison */}
            <div className="grid grid-cols-2 gap-4">
              {/* Original Template */}
              <div className="bg-navy/40 border border-border/80 rounded-xl p-4 flex flex-col items-center">
                <span className="text-[10px] text-muted uppercase font-dm tracking-wider mb-3">Original Template</span>
                <div className="w-20 h-20 rounded-full bg-linear-to-br from-blue/20 to-indigo/20 border-2 border-dashed border-border grid place-items-center text-muted text-lg font-syne font-bold select-none mb-3">
                  {activeReq.originalAvatar}
                </div>
                <span className="text-xs text-muted font-dm">Face ID Verified</span>
              </div>

              {/* Newly Uploaded verification scan */}
              <div className="bg-navy/40 border border-cyan/20 rounded-xl p-4 flex flex-col items-center">
                <span className="text-[10px] text-cyan uppercase font-dm tracking-wider mb-3">Requested Update</span>
                <div className="w-20 h-20 rounded-full bg-linear-to-br from-blue to-cyan border-2 border-cyan grid place-items-center text-white text-lg font-syne font-bold shadow-lg shadow-cyan/15 select-none mb-3">
                  {activeReq.newAvatar}
                </div>
                <span className="text-xs text-cyan font-dm font-semibold">New Scan Uploaded</span>
              </div>
            </div>

            {/* AI match review details */}
            <div className="flex items-start gap-2.5 bg-navy/60 border border-border rounded-xl p-3 text-xs text-muted font-dm">
              <FiTrendingUp className="text-cyan text-base flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white-soft mb-0.5">Biometric Confidence Level</p>
                <p>
                  AI Match Confidence is <strong className="text-cyan">{activeReq.aiScore}%</strong>.{' '}
                  {activeReq.aiScore < 70 ? (
                    <span className="text-gold font-medium">Low correlation detected. Verify facial features manually.</span>
                  ) : (
                    <span>Satisfactory biometric comparison. Face landmarks closely resemble original template.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Rejection comment form */}
            {showRejectForm && (
              <div className="space-y-3 border-t border-border/30 pt-4 animate-fade-slide-in font-dm text-sm">
                <label className="block text-xs font-semibold text-red uppercase">Reason for Rejection</label>
                <div className="flex gap-2">
                  <textarea
                    required
                    placeholder="Provide details for student (e.g. webcam scan too dark, face partially covered)..."
                    value={rejectFeedback}
                    onChange={(e) => setRejectFeedback(e.target.value)}
                    className="flex-1 bg-navy border border-border rounded-xl py-2 px-3 text-white-soft placeholder:text-muted focus:border-red/40 outline-none h-16 text-xs resize-none"
                  />
                  <button
                    onClick={() => handleReject(activeReq.id, activeReq.name)}
                    className="flex items-center justify-center bg-red text-white px-4 rounded-xl font-semibold cursor-pointer text-xs hover:bg-red/90 transition-colors border-0 h-16"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Approve / Reject buttons */}
            <div className="flex gap-3 pt-3 border-t border-border/30">
              {!showRejectForm && (
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-red/40 hover:border-red hover:bg-red/10 text-red font-dm font-semibold text-sm py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  <FiXCircle className="text-base" />
                  <span>Reject Request</span>
                </button>
              )}
              <button
                onClick={() => handleApprove(activeReq.id, activeReq.name)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-linear-to-r from-blue to-blue-bright text-white font-dm font-semibold text-sm py-2.5 rounded-xl cursor-pointer shadow-lg hover:brightness-110 transition-colors border-0"
              >
                <FiCheckCircle className="text-base" />
                <span>Approve Template</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-navy-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center font-dm">
          <FiInbox className="text-muted text-4xl mb-3" />
          <h3 className="font-syne font-bold text-white-soft text-base">All caught up!</h3>
          <p className="text-muted text-sm mt-1">
            No biometric approval requests are pending administrative review.
          </p>
        </div>
      )}
    </div>
  );
}
