import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { useToast } from '../../contexts/ToastContext';
import { requestDemo } from '../../services/contactApi';

interface ContactForm {
  schoolName: string;
  contactPersonName: string;
  email: string;
  phoneNumber: string;
  message: string;
}

const EMPTY_FORM: ContactForm = {
  schoolName: '', contactPersonName: '', email: '', phoneNumber: '', message: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const inp = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schoolName.trim() || !form.contactPersonName.trim() || !form.email.trim() || !form.phoneNumber.trim()) {
      toast.warning('Required', 'Please fill in all required fields.');
      return;
    }
    if (form.schoolName.trim().length > 150) {
      toast.warning('Invalid', 'School name must be 150 characters or fewer.');
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      toast.warning('Invalid', 'Please enter a valid email address.');
      return;
    }
    if (form.message.trim().length > 500) {
      toast.warning('Invalid', 'Message must be 500 characters or fewer.');
      return;
    }
    setSubmitting(true);
    try {
      await requestDemo({
        schoolName: form.schoolName.trim(),
        contactPersonName: form.contactPersonName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        message: form.message.trim() || undefined,
      });
      toast.success('Request sent', 'We will get back to you shortly.');
      onClose();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to send your request.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="font-syne font-bold text-white-soft text-lg">Contact Us</h2>
            <p className="text-muted text-sm mt-1">Tell us about your school — we'll reach out to set up a demo.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors bg-transparent shrink-0"
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar min-h-0">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              School Name * <span className="normal-case font-normal">({form.schoolName.length}/150)</span>
            </label>
            <input
              type="text"
              value={form.schoolName}
              onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
              placeholder="e.g. FPT University"
              maxLength={150}
              className={inp}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Contact Person *</label>
            <input
              type="text"
              value={form.contactPersonName}
              onChange={(e) => setForm((f) => ({ ...f, contactPersonName: e.target.value }))}
              placeholder="Your full name"
              className={inp}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@school.edu"
                className={inp}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phone Number *</label>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                placeholder="+84 ..."
                className={inp}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Message <span className="normal-case font-normal">({form.message.length}/500)</span>
            </label>
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="What would you like to know?"
              maxLength={500}
              rows={4}
              className={`${inp} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
