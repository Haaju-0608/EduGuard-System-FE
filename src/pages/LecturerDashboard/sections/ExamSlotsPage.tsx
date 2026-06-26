import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiFileText, FiPlus, FiSearch, FiTrash2, FiUsers, FiX } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  CourseCodeBadge,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SkeletonCard,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useListFilters } from '../../../hooks/useListFilters';
import { useLecturerFaculty } from '../../../hooks/useLecturerFaculty';
import {
  createExamParticipation,
  deleteExamParticipation,
  fetchExamParticipations,
  fetchExamSlots,
  updateParticipationStatus,
} from '../../../services/schoolAdminApi';
import type { ApiExamParticipation, ParticipationStatus } from '../../../types/api';
import type { ExamSlot, ExamSlotStatus } from '../../../types/lecturer';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ExamStatusBadge({ status }: { status: ExamSlotStatus }) {
  const config: Record<ExamSlotStatus, { label: string; className: string }> = {
    scheduled: { label: 'Scheduled', className: 'text-blue-bright bg-blue/10 border-blue/25' },
    ongoing: { label: 'Ongoing', className: 'text-green bg-green/10 border-green/25 animate-pulse' },
    completed: { label: 'Completed', className: 'text-muted bg-white/5 border-border' },
    cancelled: { label: 'Cancelled', className: 'text-red bg-red/10 border-red/25' },
  };
  const { label, className } = config[status] ?? { label: status, className: 'text-muted border-border' };
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>{label}</span>;
}

const PARTICIPATION_COLORS: Record<ParticipationStatus, string> = {
  Joined: 'text-green bg-green/10 border-green/25',
  Submitted: 'text-blue-bright bg-blue/10 border-blue/25',
  Disqualified: 'text-red bg-red/10 border-red/25',
  Absent: 'text-muted bg-white/5 border-border',
  Left: 'text-gold bg-gold/10 border-gold/25',
};

// ─── Participants Panel ───────────────────────────────────────────────────

function ParticipantsPanel({ slot, onClose }: { slot: ExamSlot; onClose: () => void }) {
  const toast = useToast();
  const [addStudentId, setAddStudentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const { data, loading, reload } = useAsyncData(
    () => fetchExamParticipations(slot.id, { page: 1, pageSize: 100 }),
    [slot.id],
  );
  const participants: ApiExamParticipation[] = data?.items ?? [];

  const handleAdd = async () => {
    if (!addStudentId.trim()) return;
    setSubmitting(true);
    try {
      await createExamParticipation({ examSlotId: slot.id, studentId: addStudentId.trim() });
      toast.success('Added', 'Student added to exam.');
      setAddStudentId('');
      reload();
    } catch {
      toast.error('Error', 'Failed to add student. Check the Student ID.');
    } finally { setSubmitting(false); }
  };

  const handleStatusChange = async (p: ApiExamParticipation, status: ParticipationStatus) => {
    setActionId(p.id);
    try {
      await updateParticipationStatus(p.examSlotId, status);
      toast.success('Updated', `Status changed to ${status}.`);
      reload();
    } catch {
      toast.error('Error', 'Failed to update status.');
    } finally { setActionId(null); }
  };

  const handleDelete = async (p: ApiExamParticipation) => {
    if (!window.confirm('Remove this student from the exam?')) return;
    setActionId(p.id);
    try {
      await deleteExamParticipation(p.examSlotId);
      toast.success('Removed', 'Student removed from exam.');
      reload();
    } catch {
      toast.error('Error', 'Failed to remove student.');
    } finally { setActionId(null); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">{slot.classCode}</p>
            <h2 className="font-syne font-bold text-white-soft text-lg">{slot.examName}</h2>
            <p className="text-xs text-muted mt-1">
              {formatDateTime(slot.startTime)} → {formatDateTime(slot.endTime)}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors">
            <FiX />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">Add Student by ID</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Student ID or UUID..."
              value={addStudentId}
              onChange={(e) => setAddStudentId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 bg-navy border border-border rounded-xl px-4 py-2 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted"
            />
            <button
              onClick={handleAdd}
              disabled={!addStudentId.trim() || submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-40 transition-colors border-none"
            >
              <FiPlus /> {submitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : participants.length === 0 ? (
            <div className="py-16 text-center">
              <FiUsers className="text-3xl text-muted mx-auto mb-3" />
              <p className="text-muted text-sm">No participants yet. Add students above.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {participants.map((p) => {
                const name = p.student?.fullName ?? p.studentId.slice(0, 12);
                const email = p.student?.email ?? '';
                const code = p.student?.studentCode ?? '';
                const isActing = actionId === p.id;
                return (
                  <div key={p.id} className="flex items-center gap-4 px-6 py-3 hover:bg-navy/40 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-sm font-bold text-blue-bright shrink-0">
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white-soft truncate">{name}</p>
                      <p className="text-[11px] text-muted truncate">{code && `${code} · `}{email}</p>
                    </div>
                    <CustomSelect
                      variant="inline"
                      value={p.status}
                      onChange={(v) => handleStatusChange(p, v as ParticipationStatus)}
                      disabled={isActing}
                      colorClass={PARTICIPATION_COLORS[p.status] ?? 'text-muted border-border'}
                      options={(['Joined','Submitted','Disqualified','Absent','Left'] as ParticipationStatus[]).map((s) => ({value:s,label:s}))}
                    />
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={isActing}
                      className="w-7 h-7 rounded-lg bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-all disabled:opacity-40"
                    >
                      <FiTrash2 className="text-xs" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {participants.length > 0 && (
          <div className="px-6 py-3 border-t border-border shrink-0 flex gap-4 text-xs text-muted">
            <span><strong className="text-white-soft">{participants.length}</strong> total</span>
            <span><strong className="text-green">{participants.filter(p => p.status === 'Joined' || p.status === 'Submitted').length}</strong> active</span>
            <span><strong className="text-red">{participants.filter(p => p.status === 'Disqualified').length}</strong> disqualified</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Exam Slot Card ───────────────────────────────────────────────────────

function ExamSlotCard({ slot, index, onViewParticipants }: {
  slot: ExamSlot; index: number;
  onViewParticipants: (slot: ExamSlot) => void;
}) {
  const navigate = useNavigate();

  const goToQuestions = () => {
    localStorage.setItem(`examName_${slot.id}`, slot.examName);
    navigate(`/lecture/exams/${slot.id}/questions`);
  };

  return (
    <AnimateIn index={index}>
      <UniCard className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <CourseCodeBadge code={slot.classCode} size="sm" />
            <h3 className="font-syne font-bold text-white-soft mt-2 text-[1.05rem]">{slot.examName}</h3>
            <p className="text-sm text-muted mt-1">{slot.className}</p>
          </div>
          <ExamStatusBadge status={slot.status} />
        </div>

        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
            <FiCalendar className="text-cyan shrink-0" />
            <span>Start: {formatDateTime(slot.startTime)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
            <FiCalendar className="text-cyan shrink-0" />
            <span>End: {formatDateTime(slot.endTime)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
            <FiClock className="text-cyan shrink-0" />
            <span>Duration: {slot.durationMinutes > 0 ? `${slot.durationMinutes} min` : 'Not set'}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={goToQuestions}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gold/30 text-gold text-sm font-semibold cursor-pointer hover:bg-gold/10 transition-colors bg-transparent"
          >
            <FiFileText className="text-sm" /> Questions
          </button>
          <button
            onClick={() => onViewParticipants(slot)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue/30 text-blue-bright text-sm font-semibold cursor-pointer hover:bg-blue/10 transition-colors bg-transparent"
          >
            <FiUsers className="text-sm" /> Participants
          </button>
        </div>
      </UniCard>
    </AnimateIn>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ExamSlotsPage() {
  const { facultyId } = useLecturerFaculty();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamSlotStatus | 'all'>('all');
  const [selectedSlot, setSelectedSlot] = useState<ExamSlot | null>(null);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const result = await fetchExamSlots({ page: 1, pageSize: 100 });
    return result.items;
  }, []);

  const slots = data ?? [];

  const predicates = useMemo(
    () => [(slot: ExamSlot) => statusFilter === 'all' || slot.status === statusFilter],
    [statusFilter],
  );

  const filteredSlots = useListFilters(slots, search, ['examName', 'classCode', 'className'], predicates);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Exam Schedule"
        title="Exam Slots"
        subtitle="View exam sessions and manage participants."
        facultyId={facultyId}
        stats={[
          { label: 'Total Slots', value: String(slots.length), icon: '📝' },
          { label: 'Scheduled', value: String(slots.filter(s => s.status === 'scheduled').length), icon: '📅' },
          { label: 'Ongoing', value: String(slots.filter(s => s.status === 'ongoing').length), icon: '🔴' },
          { label: 'Completed', value: String(slots.filter(s => s.status === 'completed').length), icon: '✅' },
        ]}
      />

      <FilterBar>
        <div className="uni-filter-input">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search exam name, course code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as ExamSlotStatus | 'all')}
          options={[
            {value:'all',label:'All Statuses'},
            {value:'scheduled',label:'Scheduled'},
            {value:'ongoing',label:'Ongoing'},
            {value:'completed',label:'Completed'},
            {value:'cancelled',label:'Cancelled'},
          ]}
        />
      </FilterBar>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState variant="error" icon="📝" title="Failed to load exam slots" description={error} onRetry={reload} />
      ) : filteredSlots.length === 0 ? (
        <EmptyState icon="📝" title="No exam slots" description="No exam slots assigned to your classes yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSlots.map((slot, i) => (
            <ExamSlotCard key={slot.id} slot={slot} index={i} onViewParticipants={setSelectedSlot} />
          ))}
        </div>
      )}

      {selectedSlot && (
        <ParticipantsPanel slot={selectedSlot} onClose={() => setSelectedSlot(null)} />
      )}
    </PageShell>
  );
}
