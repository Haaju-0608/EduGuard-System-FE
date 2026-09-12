import React, { useEffect, useState } from 'react';
import { FiInfo, FiRefreshCw, FiSave, FiShield } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  createProctoringSettings,
  fetchEffectiveProctoringSettings,
  updateProctoringSettings,
} from '../../../services/schoolAdminApi';
import type {
  ProctoringSettingsFormFields,
  ProctoringViolationTypeThreshold,
} from '../../../types/termination';
import { getViolationLabel } from '../../../utils/violationLabels';

// 5 loại vi phạm AI thực sự có detector — khớp đúng ViolationEngine.ts (FE) hiện chỉ phát hiện
// được 5 loại này. BE cho phép cấu hình cả "Impersonation" (còn nằm trong AiViolationTypes,
// ProctoringSettingsService.cs) nhưng KHÔNG có nơi nào tạo ra vi phạm loại đó — chưa có tính năng
// tái xác thực khuôn mặt giữa giờ thi — nên cố tình ẩn khỏi UI để SchoolAdmin không hiểu nhầm là
// tính năng đã hoạt động. Bỏ nó khỏi mảng này là đủ: form không còn render/gửi threshold cho
// Impersonation nữa (BE không yêu cầu đủ mọi loại khi Save — ValidateThresholds chỉ kiểm tra
// loại nào GỬI LÊN có hợp lệ không, không bắt buộc phải gửi đủ cả 6). Bật lại bằng cách thêm
// 'Impersonation' vào mảng này khi tính năng thật được implement.
const AI_VIOLATION_TYPES: ProctoringViolationTypeThreshold['violationType'][] = [
  'HeadTurn', 'GazeDiversion', 'FaceObstructed', 'MultipleFaces', 'Absence',
];

const inp = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const inpSm = 'w-28 shrink-0 bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const lbl = 'block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5';

function fieldsFromEffective(source: {
  maxAiViolationCount: number;
  cooldownSeconds: number;
  allowConsecutiveSameType: boolean;
  aiNotifyThreshold: number;
  browserNotifyThreshold: number;
  violationTypeThresholds: ProctoringViolationTypeThreshold[];
}): ProctoringSettingsFormFields {
  const byType = new Map(source.violationTypeThresholds.map((t) => [t.violationType, t.detectionThresholdSeconds]));
  return {
    maxAiViolationCount: source.maxAiViolationCount,
    cooldownSeconds: source.cooldownSeconds,
    allowConsecutiveSameType: source.allowConsecutiveSameType,
    aiNotifyThreshold: source.aiNotifyThreshold,
    browserNotifyThreshold: source.browserNotifyThreshold,
    violationTypeThresholds: AI_VIOLATION_TYPES.map((violationType) => ({
      violationType,
      detectionThresholdSeconds: byType.get(violationType) ?? 3,
    })),
  };
}

export default function ProctoringSettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const institutionId = user?.institutionId ?? '';

  const { data, loading, error, reload } = useAsyncData(
    () => fetchEffectiveProctoringSettings(),
    [institutionId],
  );

  // effective.institutionId chỉ trùng institution của mình khi đây thực sự là config riêng đã
  // lưu — nếu BE đang fallback về mặc định hệ thống thì field này là null (config gốc không
  // thuộc institution nào), báo hiệu "chưa có config riêng, Save đầu tiên phải POST".
  const hasOwnConfig = !!data && data.institutionId === institutionId;

  const [form, setForm] = useState<ProctoringSettingsFormFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (data) setForm(fieldsFromEffective(data));
  }, [data]);

  // Mọi field số ở trang này (kể cả từng loại threshold) đều là `int` bên BE (xem
  // ProctoringSettingsRequestDto.cs) — gõ "1.5" từng gây lỗi 400 "The JSON value could not be
  // converted to System.Int32" mà UI không hề ngăn hay báo trước. Làm tròn ngay lúc nhập (không
  // chỉ validate lúc Save) để state không bao giờ giữ số thập phân, và input NaN (ô trống/gõ chữ)
  // giữ nguyên giá trị cũ thay vì crash hoặc gửi NaN lên BE.
  const roundOrKeep = (raw: string, previous: number) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.round(parsed) : previous;
  };

  const setField = <K extends keyof ProctoringSettingsFormFields>(key: K, value: ProctoringSettingsFormFields[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const setIntField = (key: 'maxAiViolationCount' | 'cooldownSeconds' | 'aiNotifyThreshold' | 'browserNotifyThreshold', raw: string) => {
    setForm((f) => f && { ...f, [key]: roundOrKeep(raw, f[key]) });
  };

  const setThreshold = (violationType: ProctoringViolationTypeThreshold['violationType'], raw: string) => {
    setForm((f) => f && {
      ...f,
      violationTypeThresholds: f.violationTypeThresholds.map((t) =>
        t.violationType === violationType
          ? { ...t, detectionThresholdSeconds: roundOrKeep(raw, t.detectionThresholdSeconds) }
          : t,
      ),
    });
  };

  function validate(f: ProctoringSettingsFormFields): string | null {
    if (f.maxAiViolationCount < 1 || f.maxAiViolationCount > 1000) return 'Max AI Violation Count must be between 1 and 1000.';
    if (f.cooldownSeconds < 0 || f.cooldownSeconds > 3600) return 'Cooldown Seconds must be between 0 and 3600.';
    if (f.aiNotifyThreshold < 1 || f.aiNotifyThreshold > 1000) return 'AI Notify Threshold must be between 1 and 1000.';
    if (f.browserNotifyThreshold < 1 || f.browserNotifyThreshold > 1000) return 'Browser Notify Threshold must be between 1 and 1000.';
    for (const t of f.violationTypeThresholds) {
      if (t.detectionThresholdSeconds < 1 || t.detectionThresholdSeconds > 3600) {
        return `${getViolationLabel(t.violationType).label} threshold must be between 1 and 3600 seconds.`;
      }
    }
    return null;
  }

  const handleSave = async () => {
    if (!form || !institutionId) return;
    const invalidReason = validate(form);
    if (invalidReason) { toast.warning('Invalid', invalidReason); return; }

    setSaving(true);
    try {
      if (hasOwnConfig && data) {
        await updateProctoringSettings(data.id, { ...form, isActive: true });
      } else {
        await createProctoringSettings({ ...form, institutionId });
      }
      toast.success('Saved', 'AI Proctoring settings updated.');
      reload();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to save proctoring settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!form || !data || !hasOwnConfig) return;
    setResetting(true);
    try {
      await updateProctoringSettings(data.id, { ...form, isActive: false });
      toast.success('Reset', 'This school is now using the system-wide default settings.');
      reload();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to reset proctoring settings.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue/10 border border-blue/25 grid place-items-center text-blue-bright text-lg shrink-0">
            <FiShield />
          </div>
          <div>
            <h1 className="font-syne text-2xl font-extrabold text-white-soft">AI Proctoring Settings</h1>
            <p className="text-muted text-sm mt-1">Configure how strictly the AI proctor flags and escalates violations during exams for your school.</p>
          </div>
        </div>
        {!loading && data && (
          hasOwnConfig ? (
            <span className="text-[10px] font-bold text-green bg-green/10 border border-green/25 px-2.5 py-1 rounded-full shrink-0">Custom Configuration</span>
          ) : (
            <span className="text-[10px] font-bold text-muted bg-white/5 border border-border px-2.5 py-1 rounded-full shrink-0">System Default</span>
          )
        )}
      </div>

      {loading ? (
        <div className="bg-navy-card border border-border rounded-[20px] p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-10 text-center text-muted text-sm">
          Failed to load.{' '}
          <button onClick={reload} className="text-blue-bright underline bg-transparent border-none cursor-pointer">Retry</button>
        </div>
      ) : !form ? null : (
        <>
          {!hasOwnConfig && (
            <div className="bg-blue/5 border border-blue/20 rounded-xl p-4 flex items-start gap-3 text-sm text-muted">
              <FiInfo className="text-blue-bright mt-0.5 shrink-0" />
              <span>
                Your school hasn&apos;t customized these settings yet — it currently inherits the{' '}
                <strong className="text-white-soft">system-wide default</strong>. Adjust values below and Save to
                create your own configuration.
              </span>
            </div>
          )}

          {/* General thresholds */}
          <div className="bg-navy-card border border-border rounded-[20px] p-6">
            <p className="text-sm font-bold text-white-soft mb-4">General Thresholds</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Max AI Violation Count</label>
                <input
                  type="number" min={1} max={1000} step={1} className={inp}
                  value={form.maxAiViolationCount}
                  onChange={(e) => setIntField('maxAiViolationCount', e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1">Stop recording new AI violations once a student hits this count.</p>
              </div>
              <div>
                <label className={lbl}>Cooldown (seconds)</label>
                <input
                  type="number" min={0} max={3600} step={1} className={inp}
                  value={form.cooldownSeconds}
                  onChange={(e) => setIntField('cooldownSeconds', e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1">Minimum gap between two recorded AI violations.</p>
              </div>
              <div>
                <label className={lbl}>AI Notify Threshold</label>
                <input
                  type="number" min={1} max={1000} step={1} className={inp}
                  value={form.aiNotifyThreshold}
                  onChange={(e) => setIntField('aiNotifyThreshold', e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1">AI violation count that triggers a lecturer notification.</p>
              </div>
              <div>
                <label className={lbl}>Browser Notify Threshold</label>
                <input
                  type="number" min={1} max={1000} step={1} className={inp}
                  value={form.browserNotifyThreshold}
                  onChange={(e) => setIntField('browserNotifyThreshold', e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1">Browser violation count (tab switch, etc.) that triggers a lecturer notification.</p>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none mt-4">
              <input
                type="checkbox"
                checked={form.allowConsecutiveSameType}
                onChange={(e) => setField('allowConsecutiveSameType', e.target.checked)}
                className="w-4 h-4 accent-blue-bright cursor-pointer"
              />
              <span className="text-sm text-white-soft">Allow two consecutive violations of the same type to both count</span>
            </label>
          </div>

          {/* Per-violation-type thresholds */}
          <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <p className="text-sm font-bold text-white-soft">Detection Thresholds</p>
              <p className="text-[11px] text-muted mt-1">Seconds a signal must persist before it counts as a violation, per type.</p>
            </div>
            <div className="divide-y divide-border">
              {form.violationTypeThresholds.map((t) => {
                const meta = getViolationLabel(t.violationType);
                return (
                  <div key={t.violationType} className="flex items-center gap-4 px-6 py-3.5">
                    <span className="text-lg shrink-0">{meta.icon}</span>
                    <p className="text-sm font-semibold text-white-soft flex-1 min-w-0">{meta.label}</p>
                    <input
                      type="number" min={1} max={3600} step={1}
                      className={inpSm}
                      value={t.detectionThresholdSeconds}
                      onChange={(e) => setThreshold(t.violationType, e.target.value)}
                    />
                    <span className="text-[11px] text-muted w-10 shrink-0">sec</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {hasOwnConfig ? (
              <button
                onClick={handleReset}
                disabled={resetting || saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-red/40 hover:text-red disabled:opacity-50 transition-colors bg-transparent"
              >
                <FiRefreshCw /> {resetting ? 'Resetting…' : 'Reset to System Default'}
              </button>
            ) : <span />}
            <button
              onClick={handleSave}
              disabled={saving || resetting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none"
            >
              <FiSave /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
