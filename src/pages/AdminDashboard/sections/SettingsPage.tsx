import React, { useState } from 'react';
import { FiSettings, FiSliders, FiKey, FiDatabase, FiCheckCircle, FiEye, FiEyeOff } from 'react-icons/fi';

export default function SettingsPage() {
  const [matchThreshold, setMatchThreshold] = useState(85);
  const [headPoseLimit, setHeadPoseLimit] = useState(25);
  const [maxViolations, setMaxViolations] = useState(3);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  // Mask/Reveal Key States
  const [showFaceApiKey, setShowFaceApiKey] = useState(false);
  const [faceApiKey, setFaceApiKey] = useState('sk_live_51Msz8J481A02vK9d10eK10s...');
  const [webhookUrl, setWebhookUrl] = useState('https://portal.university.edu/api/eduguard-webhook');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('System configuration preferences saved successfully!');
  };

  const handleBackup = () => {
    setIsBackingUp(true);
    setBackupProgress(0);

    const interval = setInterval(() => {
      setBackupProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsBackingUp(false);
            showToast('System database backup archived successfully!');
          }, 300);
          return 100;
        }
        return prev + 20;
      });
    }, 200);
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
          <FiSettings className="text-muted" />
          System Settings
        </h1>
        <p className="text-muted font-dm text-sm mt-1">
          Tune AI thresholds, configure API integrations, and perform system database backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: AI & Proctoring Configurations (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI configurations */}
          <div className="bg-navy-card border border-border rounded-2xl p-5">
            <h3 className="font-syne font-bold text-white-soft text-base mb-5 flex items-center gap-2">
              <FiSliders className="text-blue-bright" />
              AI Proctoring Parameters
            </h3>

            <form onSubmit={handleSaveConfig} className="space-y-5 font-dm text-sm">
              {/* Slider: Match Threshold */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-white-soft font-medium">Face Match Threshold</label>
                  <span className="font-mono text-xs text-cyan font-bold">{matchThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={matchThreshold}
                  onChange={(e) => setMatchThreshold(parseInt(e.target.value))}
                  className="w-full accent-cyan h-1 bg-navy rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-muted mt-1">
                  Minimum confidence rate required to successfully identify a student face landmarks.
                </p>
              </div>

              {/* Slider: Pose Tolerance */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-white-soft font-medium">Head Pose Angle Tolerance</label>
                  <span className="font-mono text-xs text-cyan font-bold">{headPoseLimit}°</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="45"
                  value={headPoseLimit}
                  onChange={(e) => setHeadPoseLimit(parseInt(e.target.value))}
                  className="w-full accent-cyan h-1 bg-navy rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-muted mt-1">
                  Allowed degrees of vertical/horizontal head rotation before flagging a potential exam gaze violation.
                </p>
              </div>

              {/* Input: Violation Trigger threshold */}
              <div>
                <label className="block text-white-soft font-medium mb-1.5">Auto-Suspension Violations Count</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxViolations}
                  onChange={(e) => setMaxViolations(parseInt(e.target.value))}
                  className="w-[120px] bg-navy border border-border rounded-xl py-2 px-3 text-white-soft outline-none focus:border-blue-bright/40 font-mono"
                />
                <p className="text-[10px] text-muted mt-1">
                  Number of consecutive critical alerts (e.g. absent, secondary person) before an automated exam lockout.
                </p>
              </div>

              <div className="border-t border-border/30 pt-4 flex justify-end">
                <button
                  type="submit"
                  className="bg-linear-to-r from-blue to-blue-bright text-white font-semibold py-2.5 px-6 rounded-xl cursor-pointer hover:brightness-110 shadow-lg transition-colors border-0"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>

          {/* API keys integration */}
          <div className="bg-navy-card border border-border rounded-2xl p-5">
            <h3 className="font-syne font-bold text-white-soft text-base mb-5 flex items-center gap-2">
              <FiKey className="text-gold" />
              API Key Credentials
            </h3>

            <div className="space-y-4 font-dm text-sm">
              <div>
                <label className="block text-muted font-medium mb-1.5">FaceAPI Private Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showFaceApiKey ? 'text' : 'password'}
                      readOnly
                      value={faceApiKey}
                      className="w-full bg-navy border border-border rounded-xl py-2 pl-3 pr-10 text-white-soft font-mono text-xs outline-none select-all"
                    />
                    <button
                      onClick={() => setShowFaceApiKey(!showFaceApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white-soft cursor-pointer bg-transparent border-0"
                    >
                      {showFaceApiKey ? <FiEyeOff className="text-xs" /> : <FiEye className="text-xs" />}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(faceApiKey);
                      showToast('FaceAPI private key copied to clipboard!');
                    }}
                    className="px-3 border border-border hover:border-cyan hover:bg-cyan/10 rounded-xl text-xs text-white-soft font-medium transition-colors cursor-pointer bg-transparent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-muted font-medium mb-1.5">Webhook Endpoint URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-navy border border-border rounded-xl py-2 px-3 text-white-soft font-mono text-xs focus:border-blue-bright/40 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Database stats & Backup controls (1/3) */}
        <div className="bg-navy-card border border-border rounded-2xl p-5 flex flex-col justify-between font-dm text-sm h-full">
          <div className="space-y-5">
            <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <FiDatabase className="text-cyan" />
              System Database Status
            </h3>

            <div className="space-y-3">
              {[
                { label: 'Database Engine', value: 'PostgreSQL 15', status: 'Healthy' },
                { label: 'Data Size', value: '48.2 MB', status: 'Healthy' },
                { label: 'Last Backup', value: 'June 06, 04:00', status: 'Healthy' },
                { label: 'API Telemetry Server', value: 'EduGuard Core Cloud', status: 'Online' },
              ].map((db, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border/30">
                  <div>
                    <p className="text-xs font-semibold text-white-soft">{db.label}</p>
                    <p className="text-[10px] text-muted">{db.value}</p>
                  </div>
                  <span className="text-[9px] font-semibold text-green bg-green/10 border border-green/20 px-2 py-0.5 rounded-full">
                    {db.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-border/30 mt-6">
            {isBackingUp ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted font-mono">
                  <span>Archiving schemas...</span>
                  <span>{backupProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-navy rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan transition-all duration-100"
                    style={{ width: `${backupProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleBackup}
                className="w-full flex items-center justify-center gap-2 bg-transparent text-cyan border border-cyan/40 hover:bg-cyan/10 hover:border-cyan/70 font-semibold py-2.5 rounded-xl cursor-pointer transition-all duration-300"
              >
                <FiDatabase className="text-sm animate-bounce" />
                <span>Create Database Backup</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
