import React, { useState } from 'react';
import { FiSearch, FiChevronDown, FiUserPlus, FiTrash2, FiEdit2, FiRefreshCw, FiCheckCircle, FiXCircle, FiX } from 'react-icons/fi';

type UserRole = 'Student' | 'Instructor';
type UserStatus = 'Active' | 'Warning' | 'Suspended';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  dept: string;
  status: UserStatus;
  biometrics: 'Registered' | 'Not Registered' | 'Pending';
  lastSeen?: string;
}

const initialUsers: UserRecord[] = [
  { id: 'SV820491', name: 'Nguyen Van An', email: 'user@eduguard.com', role: 'Student', dept: 'IT', status: 'Active', biometrics: 'Registered', lastSeen: '2 min ago' },
  { id: 'SV820492', name: 'Tran Thi Bao', email: 'bao.tran@edu.vn', role: 'Student', dept: 'CS', status: 'Active', biometrics: 'Registered', lastSeen: '10 min ago' },
  { id: 'GV301021', name: 'Dr. Le Minh', email: 'leminh@edu.vn', role: 'Instructor', dept: 'Math', status: 'Active', biometrics: 'Registered', lastSeen: '1h ago' },
  { id: 'SV820493', name: 'Pham Duc', email: 'phamduc@edu.vn', role: 'Student', dept: 'IT', status: 'Warning', biometrics: 'Pending', lastSeen: '2h ago' },
  { id: 'GV301022', name: 'Vo Thi Lan', email: 'volan@edu.vn', role: 'Instructor', dept: 'English', status: 'Active', biometrics: 'Registered', lastSeen: '5 min ago' },
  { id: 'SV820494', name: 'Bui Kim', email: 'buikim@edu.vn', role: 'Student', dept: 'CS', status: 'Suspended', biometrics: 'Not Registered', lastSeen: '3 days ago' },
  { id: 'SV820495', name: 'Le Quang Minh', email: 'minh.lq@edu.vn', role: 'Student', dept: 'Business', status: 'Active', biometrics: 'Registered', lastSeen: '15 min ago' },
  { id: 'GV301023', name: 'Prof. Sarah Connor', email: 'sconnor@edu.vn', role: 'Instructor', dept: 'CS', status: 'Active', biometrics: 'Registered', lastSeen: 'Just now' },
];

const statusConfig: Record<UserStatus, { bg: string; text: string; border: string }> = {
  Active: { bg: 'bg-green/10', text: 'text-green', border: 'border-green/20' },
  Warning: { bg: 'bg-gold/10', text: 'text-gold', border: 'border-gold/20' },
  Suspended: { bg: 'bg-red/10', text: 'text-red', border: 'border-red/20' },
};

const bioConfig = {
  Registered: { bg: 'bg-blue-bright/10 text-blue-bright border-blue-bright/20', icon: '🟢' },
  'Not Registered': { bg: 'bg-muted/10 text-muted border-border/40', icon: '⚪' },
  Pending: { bg: 'bg-gold/10 text-gold border-gold/20', icon: '🟡' },
};

export default function UserManagementPage() {
  const [usersList, setUsersList] = useState<UserRecord[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  
  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Student');
  const [newUserDept, setNewUserDept] = useState('IT');
  const [newUserStatus, setNewUserStatus] = useState<UserStatus>('Active');
  const [newUserBio, setNewUserBio] = useState<'Registered' | 'Not Registered' | 'Pending'>('Not Registered');
  
  // Custom Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId || !newUserName || !newUserEmail) {
      alert('Please fill in all required fields.');
      return;
    }

    const newUser: UserRecord = {
      id: newUserId,
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      dept: newUserDept,
      status: newUserStatus,
      biometrics: newUserBio,
      lastSeen: 'Never',
    };

    setUsersList([newUser, ...usersList]);
    setIsAddModalOpen(false);
    showToast(`Successfully created user: ${newUserName} (${newUserRole})`);

    // Reset Form
    setNewUserId('');
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('Student');
    setNewUserDept('IT');
    setNewUserStatus('Active');
    setNewUserBio('Not Registered');
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete user ${name}?`)) {
      setUsersList(usersList.filter((u) => u.id !== id));
      showToast(`Deleted user: ${name}`);
    }
  };

  const handleResetBiometrics = (id: string, name: string) => {
    setUsersList(
      usersList.map((u) => {
        if (u.id === id) {
          return { ...u, biometrics: 'Not Registered' };
        }
        return u;
      })
    );
    showToast(`Biometric template reset for ${name}`);
  };

  const handleToggleStatus = (id: string) => {
    setUsersList(
      usersList.map((u) => {
        if (u.id === id) {
          const statuses: UserStatus[] = ['Active', 'Warning', 'Suspended'];
          const nextIndex = (statuses.indexOf(u.status) + 1) % statuses.length;
          const newStatus = statuses[nextIndex];
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
  };

  const filteredUsers = usersList.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'All Roles' || u.role === roleFilter;
    const matchDept = deptFilter === 'All Departments' || u.dept === deptFilter;
    return matchSearch && matchRole && matchDept;
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-syne font-extrabold text-2xl text-white-soft">User Management</h1>
          <p className="text-muted font-dm text-sm mt-1">
            Create, manage accounts, and audit biometric status for Students and Lecturers.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-linear-to-r from-blue to-blue-bright text-white font-dm font-semibold text-sm px-4 py-2.5 rounded-xl cursor-pointer shadow-[0_4px_16px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] transition-all hover:-translate-y-0.5 border-0 w-full sm:w-auto"
        >
          <FiUserPlus className="text-base" />
          <span>Add New Account</span>
        </button>
      </div>

      {/* Filters & Search Row */}
      <div className="bg-navy-card border border-border rounded-[16px] p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="flex items-center gap-2 bg-navy border border-border rounded-xl py-2 px-3 w-full md:max-w-md focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted text-base flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted w-full font-dm"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto justify-end">
          {/* Role Filter */}
          <div className="relative w-full sm:w-[160px]">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="appearance-none w-full bg-navy border border-border rounded-xl py-2 pl-3 pr-8 text-sm text-white-soft font-dm cursor-pointer focus:border-blue-bright/40 outline-none transition-colors"
            >
              <option>All Roles</option>
              <option>Student</option>
              <option>Instructor</option>
            </select>
            <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none" />
          </div>

          {/* Department Filter */}
          <div className="relative w-full sm:w-[180px]">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="appearance-none w-full bg-navy border border-border rounded-xl py-2 pl-3 pr-8 text-sm text-white-soft font-dm cursor-pointer focus:border-blue-bright/40 outline-none transition-colors"
            >
              <option>All Departments</option>
              <option>IT</option>
              <option>CS</option>
              <option>Math</option>
              <option>English</option>
              <option>Business</option>
            </select>
            <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-navy-card border border-border rounded-[16px] p-5">
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm font-dm">
            <thead>
              <tr className="bg-navy/80">
                <th className="text-left py-3.5 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">User Info</th>
                <th className="text-left py-3.5 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">ID</th>
                <th className="text-left py-3.5 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">Role</th>
                <th className="text-left py-3.5 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">Department</th>
                <th className="text-left py-3.5 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">Biometrics</th>
                <th className="text-left py-3.5 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">Status</th>
                <th className="text-right py-3.5 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u, i) => {
                  const sc = statusConfig[u.status];
                  const bc = bioConfig[u.biometrics];
                  return (
                    <tr
                      key={u.id}
                      className={`${i % 2 === 0 ? 'bg-navy/40' : 'bg-navy-card/60'} hover:bg-cyan/5 transition-colors group`}
                    >
                      {/* User Avatar + Email */}
                      <td className="py-3.5 px-4 border-b border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="w-[36px] h-[36px] min-w-[36px] rounded-full bg-linear-to-br from-blue to-cyan grid place-items-center text-white text-xs font-syne font-bold">
                            {u.name.split(' ').map(n => n[0]).slice(-2).join('')}
                          </div>
                          <div>
                            <p className="text-white-soft font-semibold group-hover:text-cyan transition-colors line-clamp-1">{u.name}</p>
                            <p className="text-[11px] text-muted font-dm line-clamp-1">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="py-3.5 px-4 text-white-soft font-mono font-medium border-b border-border/30">{u.id}</td>

                      {/* Role */}
                      <td className="py-3.5 px-4 border-b border-border/30">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${u.role === 'Instructor' ? 'text-green bg-green/10' : 'text-blue-bright bg-blue-bright/10'}`}>
                          {u.role}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 text-muted border-b border-border/30">{u.dept}</td>

                      {/* Biometrics */}
                      <td className="py-3.5 px-4 border-b border-border/30">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${bc}`}>
                          <span>{bc.icon}</span>
                          <span>{u.biometrics}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 border-b border-border/30">
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${sc.bg} ${sc.text} ${sc.border} cursor-pointer hover:bg-white/5`}
                          title="Click to toggle status"
                        >
                          {u.status}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 border-b border-border/30 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResetBiometrics(u.id, u.name)}
                            className="p-1.5 rounded-lg border border-border/40 text-muted hover:text-cyan hover:border-cyan/30 bg-navy/40 hover:bg-navy-mid transition-colors cursor-pointer"
                            title="Reset Face ID biometrics"
                          >
                            <FiRefreshCw className="text-xs" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="p-1.5 rounded-lg border border-border/40 text-muted hover:text-red hover:border-red/30 bg-navy/40 hover:bg-navy-mid transition-colors cursor-pointer"
                            title="Delete User"
                          >
                            <FiTrash2 className="text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted font-dm">
                    No matching users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            onClick={() => setIsAddModalOpen(false)}
            className="absolute inset-0 bg-navy/80 backdrop-blur-xs cursor-pointer"
          />

          {/* Form container */}
          <div className="relative bg-navy-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-slide-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 border-b border-border/30 pb-3">
              <h3 className="font-syne font-bold text-white-soft text-lg flex items-center gap-2">
                <FiUserPlus className="text-blue-bright" />
                Add User Account
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted hover:text-white-soft cursor-pointer bg-transparent border-0"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddUser} className="space-y-4 font-dm text-sm">
              <div>
                <label className="block text-muted font-medium mb-1.5">User Role</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserRole('Student');
                      if (!newUserId.startsWith('SV')) setNewUserId('SV' + Math.floor(100000 + Math.random() * 900000));
                    }}
                    className={`flex-1 py-2 rounded-xl font-semibold border text-center cursor-pointer transition-all ${
                      newUserRole === 'Student'
                        ? 'border-blue-bright bg-blue-bright/10 text-blue-bright'
                        : 'border-border/50 bg-navy/40 text-muted hover:text-white-soft'
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserRole('Instructor');
                      if (!newUserId.startsWith('GV')) setNewUserId('GV' + Math.floor(100000 + Math.random() * 900000));
                    }}
                    className={`flex-1 py-2 rounded-xl font-semibold border text-center cursor-pointer transition-all ${
                      newUserRole === 'Instructor'
                        ? 'border-green bg-green/10 text-green'
                        : 'border-border/50 bg-navy/40 text-muted hover:text-white-soft'
                    }`}
                  >
                    Instructor
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-muted font-medium mb-1.5">User ID (e.g. SV820496)</label>
                <input
                  type="text"
                  required
                  placeholder={newUserRole === 'Student' ? 'SV820496' : 'GV301024'}
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="w-full bg-navy border border-border rounded-xl py-2 px-3 text-white-soft placeholder:text-muted focus:border-blue-bright/40 outline-none"
                />
              </div>

              <div>
                <label className="block text-muted font-medium mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-navy border border-border rounded-xl py-2 px-3 text-white-soft placeholder:text-muted focus:border-blue-bright/40 outline-none"
                />
              </div>

              <div>
                <label className="block text-muted font-medium mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john.doe@eduguard.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-navy border border-border rounded-xl py-2 px-3 text-white-soft placeholder:text-muted focus:border-blue-bright/40 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted font-medium mb-1.5">Department</label>
                  <select
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    className="w-full bg-navy border border-border rounded-xl py-2 px-3 text-white-soft focus:border-blue-bright/40 outline-none cursor-pointer"
                  >
                    <option>IT</option>
                    <option>CS</option>
                    <option>Math</option>
                    <option>English</option>
                    <option>Business</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted font-medium mb-1.5">Biometrics</label>
                  <select
                    value={newUserBio}
                    onChange={(e) => setNewUserBio(e.target.value as any)}
                    className="w-full bg-navy border border-border rounded-xl py-2 px-3 text-white-soft focus:border-blue-bright/40 outline-none cursor-pointer"
                  >
                    <option value="Not Registered">Not Registered</option>
                    <option value="Registered">Registered</option>
                    <option value="Pending">Pending Approval</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-border/30 mt-5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-white-soft font-medium bg-transparent hover:bg-navy cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-linear-to-r from-blue to-blue-bright text-white rounded-xl font-semibold cursor-pointer shadow-lg hover:brightness-110 transition-all border-0"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
