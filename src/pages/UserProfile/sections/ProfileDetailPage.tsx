import React, { useEffect, useState } from 'react';
import { FiAlertCircle, FiAward, FiCheckCircle, FiEdit2, FiLock, FiMail, FiPhone, FiSave, FiShield, FiUser, FiX } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { updateMyProfile } from '../../../services/schoolAdminApi';

export default function ProfileDetailPage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });
  useEffect(() => {
    setForm({
      fullName: user?.name ?? '',
      phone: user?.phone ?? '',
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        fullName: form.fullName.trim() || null,
        phone: form.phone.trim() || null,
      });
      await refreshProfile();
      toast.success('Saved', 'Profile updated successfully.');
      setIsEditing(false);
    } catch {
      toast.error('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ fullName: user?.name ?? '', phone: user?.phone ?? '' });
    setIsEditing(false);
  };

  const readOnlyFields = [
    { label: 'Student / Staff Code', value: user?.studentId || '—', icon: FiAward, isMono: true },
    { label: 'Role', value: user?.role ?? '—', icon: FiShield },
    { label: 'University Email', value: user?.email ?? '—', icon: FiMail },
  ];

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">My Profile</h1>
          <p className="text-muted text-sm mt-1">View your account details and update editable information.</p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent"
          >
            <FiEdit2 /> Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
            >
              <FiX /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none"
            >
              <FiSave /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left: Profile Fields */}
        <div className="bg-navy-card border border-border rounded-[20px] p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-syne font-bold text-lg text-white-soft">Profile Details</h2>
            {!isEditing && (
              <div className="flex items-center gap-1.5 text-xs text-gold bg-gold/10 px-3 py-1.5 rounded-full border border-gold/20 font-semibold">
                <FiLock className="text-xs" /> Partial Read-Only
              </div>
            )}
            {isEditing && (
              <div className="flex items-center gap-1.5 text-xs text-green bg-green/10 px-3 py-1.5 rounded-full border border-green/20 font-semibold">
                <FiEdit2 className="text-xs" /> Editing Mode
              </div>
            )}
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Editable Information</p>

            {/* Full Name */}
            <div className="bg-navy/40 border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-wider mb-2">
                <FiUser className="text-cyan text-sm" />
                <span>Full Name</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full bg-navy border border-blue-bright/30 rounded-xl px-3 py-2 text-sm text-white-soft outline-none focus:border-blue-bright/60 transition-colors placeholder:text-muted"
                  placeholder="Your full name"
                />
              ) : (
                <p className="text-sm font-semibold text-white-soft">{user?.name || '—'}</p>
              )}
            </div>

            {/* Phone */}
            <div className="bg-navy/40 border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-wider mb-2">
                <FiPhone className="text-cyan text-sm" />
                <span>Contact Phone</span>
              </div>
              {isEditing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-navy border border-blue-bright/30 rounded-xl px-3 py-2 text-sm text-white-soft outline-none focus:border-blue-bright/60 transition-colors placeholder:text-muted"
                  placeholder="+84 9xx xxx xxx"
                />
              ) : (
                <p className="text-sm font-semibold text-white-soft">{user?.phone || '—'}</p>
              )}
            </div>
          </div>

          {/* Read-only fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Read-Only (Managed by Admin)</p>
              <FiLock className="text-[10px] text-muted" />
            </div>

            <div className="bg-blue/5 border border-blue/20 rounded-xl p-3 flex gap-2 text-xs text-muted">
              <FiAlertCircle className="text-blue-bright shrink-0 mt-0.5" />
              <p>Email, role, and staff/student code are managed by the University Administrator and cannot be changed here.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {readOnlyFields.map((f) => (
                <div key={f.label} className="bg-navy/40 border border-border/50 rounded-xl p-4 relative opacity-70">
                  <FiLock className="absolute top-4 right-4 text-[10px] text-muted/40" />
                  <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-wider mb-2">
                    <f.icon className="text-cyan text-sm" />
                    <span>{f.label}</span>
                  </div>
                  <p className={`text-sm font-semibold text-white-soft/80 ${f.isMono ? 'font-mono' : ''}`}>
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Biometric Badge */}
        <div className="bg-navy-card border border-border rounded-[20px] p-6 space-y-6 flex flex-col items-center text-center">
          <h2 className="font-syne font-bold text-lg text-white-soft w-full text-left border-b border-border pb-4">
            Account Badge
          </h2>

          <div className="w-24 h-24 rounded-full bg-linear-to-br from-blue to-cyan p-0.5 shadow-[0_0_24px_rgba(37,99,235,0.25)]">
            <div className="w-full h-full rounded-full bg-navy-mid flex items-center justify-center text-white font-syne font-extrabold text-3xl">
              {initials}
            </div>
          </div>

          <div>
            <h3 className="font-syne font-bold text-base text-white-soft">{user?.name || 'User'}</h3>
            <p className="text-xs text-muted font-mono mt-0.5">{user?.email}</p>
            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue/10 border border-blue/20 text-xs text-blue-bright font-semibold">
              {user?.role}
            </div>
          </div>

          <div className="w-full bg-navy/40 border border-border/50 rounded-xl p-4 space-y-3 text-xs text-left">
            <div className="flex justify-between items-center">
              <span className="text-muted">Account Status:</span>
              <span className="text-green font-bold bg-green/10 px-2 py-0.5 rounded-full border border-green/20 flex items-center gap-1">
                <FiCheckCircle className="text-[10px]" /> Active
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-border/30 pt-3">
              <span className="text-muted">Institution:</span>
              {user?.institutionId
                ? <span className="text-white-soft font-medium text-right max-w-[60%] truncate">
                    {user.institutionName ?? `${user.institutionId.slice(0, 8)}…`}
                  </span>
                : <span className="text-muted italic">Not assigned</span>
              }
            </div>
            {user?.studentId && (
              <div className="flex justify-between items-center border-t border-border/30 pt-3">
                <span className="text-muted">Staff / Student Code:</span>
                <span className="text-white-soft font-mono font-medium">{user.studentId}</span>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted leading-relaxed">
            To update read-only fields, contact your Institution Administrator or University Registrar.
          </p>
        </div>
      </div>
    </div>
  );
}
