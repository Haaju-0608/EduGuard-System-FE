import React from 'react';
import { FiUser, FiMail, FiPhone, FiLock, FiAward, FiShield, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';

export default function ProfileDetailPage() {
  const { user } = useAuth();

  // Mock data representing full student details
  const studentDetails = {
    fullName: user?.name || 'Nguyen Van An',
    studentId: user?.studentId || '21110001',
    department: user?.department || 'Information Technology',
    class: 'IT-K21A',
    email: user?.email || 'user@eduguard.com',
    phone: '+84 901 234 567',
    enrollmentYear: '2023',
    faceStatus: 'Approved & Verified',
    registeredDate: '2025-09-15',
  };

  const fields = [
    { label: 'Full Name', value: studentDetails.fullName, icon: FiUser },
    { label: 'Student ID (MSSV)', value: studentDetails.studentId, icon: FiAward, isMono: true },
    { label: 'Department / Faculty', value: studentDetails.department, icon: FiShield },
    { label: 'Official Class', value: studentDetails.class, icon: FiShield },
    { label: 'University Email', value: studentDetails.email, icon: FiMail },
    { label: 'Contact Phone', value: studentDetails.phone, icon: FiPhone },
    { label: 'Enrollment Year', value: studentDetails.enrollmentYear, icon: FiUser },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <h1 className="font-syne text-2xl font-extrabold text-white-soft">My Profile</h1>
        <p className="text-muted text-sm mt-1">Review your official university profile data and AI face verification registry status.</p>
      </div>

      {/* Grid: Profile Fields & Face ID status */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        
        {/* Left Column: Locked Profile Data */}
        <div className="bg-navy-card border border-border rounded-[20px] p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-syne font-bold text-lg text-white-soft">Official Profile Details</h2>
            <div className="flex items-center gap-1.5 text-xs text-gold bg-gold/10 px-3 py-1.5 rounded-full border border-gold/20 font-dm font-semibold">
              <FiLock className="text-xs" /> Read-Only Profile
            </div>
          </div>

          {/* Admin Managed Warning Alert */}
          <div className="bg-blue/5 border border-blue/20 rounded-xl p-4 flex gap-3 text-xs text-muted leading-relaxed font-dm">
            <FiAlertCircle className="text-lg text-blue-bright shrink-0 mt-0.5" />
            <div>
              <p className="text-white-soft font-semibold mb-1 font-syne">Managed by Administrator</p>
              <p>This profile is officially created and managed by the **University Academic Registrar**. Students are not authorized to modify official student IDs, names, departments, or emails. If you detect any error, please contact the IT Administration or Registrar Office to request updates.</p>
            </div>
          </div>

          {/* Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.label} className="bg-navy/40 border border-border/50 rounded-xl p-4 relative group">
                <FiLock className="absolute top-4 right-4 text-[10px] text-muted/40 group-hover:text-muted/70 transition-colors" />
                <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-wider mb-2 font-dm">
                  <f.icon className="text-cyan text-sm" />
                  <span>{f.label}</span>
                </div>
                <p className={`text-sm font-semibold text-white-soft ${f.isMono ? 'font-mono' : 'font-dm'}`}>
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Biometric Profile Badge */}
        <div className="bg-navy-card border border-border rounded-[20px] p-6 space-y-6 flex flex-col items-center text-center">
          <h2 className="font-syne font-bold text-lg text-white-soft w-full text-left border-b border-border pb-4">Biometric ID</h2>
          
          {/* Avatar frame resembling ID badge card */}
          <div className="w-24 h-24 rounded-full bg-linear-to-br from-blue to-cyan p-0.5 shadow-[0_0_24px_rgba(37,99,235,0.25)]">
            <div className="w-full h-full rounded-full bg-navy-mid flex items-center justify-center text-white font-syne font-extrabold text-3xl">
              {studentDetails.fullName.split(' ').map((n) => n[0]).join('')}
            </div>
          </div>

          <div>
            <h3 className="font-syne font-bold text-base text-white-soft">{studentDetails.fullName}</h3>
            <p className="text-xs text-muted font-mono mt-0.5">ID: {studentDetails.studentId}</p>
          </div>

          <div className="w-full bg-navy/40 border border-border/50 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted font-dm">Biometric Scan:</span>
              <span className="text-green font-bold bg-green/10 px-2 py-0.5 rounded-full border border-green/20">
                {studentDetails.faceStatus}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-border/30 pt-3">
              <span className="text-muted font-dm">Registered:</span>
              <span className="text-white-soft font-mono font-medium">{studentDetails.registeredDate}</span>
            </div>
          </div>

          <div className="text-[10px] text-muted font-dm leading-relaxed">
            🎓 Face registration is verified. You can check in automatically to all online exams and classes without manual proctor intervention.
          </div>
        </div>

      </div>
    </div>
  );
}
