import React, { useState } from 'react';
import { FiSliders, FiBell, FiShield, FiMoon, FiSun } from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';

export default function SettingsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [examNotifs, setExamNotifs] = useState(true);
  const toast = useToast();

  // Helper to toggle theme
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    const root = document.documentElement;
    if (nextTheme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    toast.success('Theme Updated', `Switched to ${nextTheme === 'light' ? 'Light' : 'Dark'} Mode.`);
  };

  const handleSave = () => {
    toast.success('Settings Saved', 'Your preferences have been successfully updated.');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan/10 border border-cyan/25 flex items-center justify-center text-cyan text-xl">
            <FiSliders />
          </div>
          <div>
            <h1 className="font-syne text-2xl font-extrabold text-white-soft">Portal Settings</h1>
            <p className="text-muted text-sm mt-0.5">Customize your EduGuard student portal notification preferences and theme display.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Theme & Display */}
        <div className="bg-navy-card border border-border rounded-[20px] p-6 space-y-4">
          <h2 className="font-syne font-bold text-lg text-white-soft flex items-center gap-2 border-b border-border pb-3">
            <FiSun className="text-cyan" /> Theme Settings
          </h2>
          <p className="text-xs text-muted font-dm leading-relaxed">
            Toggle the interface theme of your portal dashboard. High-contrast settings apply automatically in Light Mode.
          </p>

          <div className="flex items-center justify-between bg-navy/40 border border-border/50 rounded-xl p-4 mt-2">
            <span className="text-sm font-semibold text-white-soft font-dm flex items-center gap-2">
              {theme === 'dark' ? <FiMoon className="text-gold" /> : <FiSun className="text-gold" />}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
            <button
              onClick={toggleTheme}
              className="px-4 py-2 rounded-xl text-xs font-syne font-bold bg-blue hover:bg-blue-bright text-white cursor-pointer transition-all border-0 shadow-sm"
            >
              Toggle Theme
            </button>
          </div>
        </div>

        {/* Card 2: Notification Settings */}
        <div className="bg-navy-card border border-border rounded-[20px] p-6 space-y-4">
          <h2 className="font-syne font-bold text-lg text-white-soft flex items-center gap-2 border-b border-border pb-3">
            <FiBell className="text-cyan" /> Notifications
          </h2>
          <p className="text-xs text-muted font-dm leading-relaxed">
            Manage how you receive updates regarding attendance logs, verification statuses, and exam schedules.
          </p>

          <div className="space-y-3 pt-2">
            {[
              { label: 'Email Alerts for Attendance', value: emailAlerts, setter: setEmailAlerts, desc: 'Receive a daily email summarizing your attendance flags.' },
              { label: 'Browser Push Notifications', value: pushNotifs, setter: setPushNotifs, desc: 'Instant desktop popup notifications on scan results.' },
              { label: 'Upcoming Exam Schedule Reminders', value: examNotifs, setter: setExamNotifs, desc: 'Get reminded 24 hours before any scheduled exam.' },
            ].map((n, i) => (
              <div key={i} className="flex items-start justify-between bg-navy/40 border border-border/50 rounded-xl p-4 gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white-soft font-dm">{n.label}</p>
                  <p className="text-[10px] text-muted font-dm leading-relaxed">{n.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={n.value}
                  onChange={(e) => n.setter(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-cyan bg-navy accent-cyan shrink-0 mt-0.5 cursor-pointer"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              className="bg-gradient-to-r from-blue to-cyan text-white font-syne font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer hover:shadow-md transition-all border-0"
            >
              Save Preferences
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
