import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheckCircle, FiUpload, FiX, FiXCircle } from 'react-icons/fi';
import { useToast } from '../../contexts/ToastContext';
import { bulkImportUsers, type BulkImportUsersResult } from '../../services/schoolAdminApi';

// POST /api/users/bulk-import — file .xlsx/.csv, cột: Email, Password, FullName, Role, StudentCode,
// Phone, InstitutionId. Tối đa 5MB / 500 dòng theo giới hạn BE.

export default function BulkImportUsersModal({
  onClose, onImported, allowedRoles,
}: { onClose: () => void; onImported: () => void; allowedRoles: string }) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportUsersResult | null>(null);

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    setFile(e.target.files?.[0] ?? null);
  };

  const handleImport = async () => {
    if (!file) { toast.warning('Required', 'Choose a .xlsx or .csv file first.'); return; }
    setImporting(true);
    try {
      const res = await bulkImportUsers(file);
      setResult(res);
      if (res.succeeded > 0) onImported();
      if (res.failed === 0) toast.success('Import complete', `${res.succeeded} of ${res.total} users created.`);
      else toast.warning('Import finished with errors', `${res.succeeded} succeeded, ${res.failed} failed.`);
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : 'Could not import the file.');
    } finally {
      setImporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-syne font-bold text-white-soft text-lg">Bulk Import Users</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors"><FiX /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="bg-blue/5 border border-blue/20 rounded-xl p-3 text-xs text-muted leading-relaxed">
            ℹ️ File .xlsx or .csv, max 5MB / 500 rows. Columns: <code className="text-white-soft">Email, Password, FullName, Role, StudentCode, Phone, InstitutionId</code>.
            {' '}<code className="text-white-soft">Role</code> should be {allowedRoles}. <code className="text-white-soft">StudentCode</code> is required for Student rows.
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-blue-bright/40 transition-colors"
          >
            <FiUpload className="text-2xl text-muted mx-auto mb-2" />
            <p className="text-sm text-white-soft">{file ? file.name : 'Click to choose a file'}</p>
            <p className="text-[11px] text-muted mt-1">.xlsx or .csv</p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handlePickFile} className="hidden" />
          </div>

          {result && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-white-soft">{result.total} rows</span>
                <span className="text-xs font-bold text-green">{result.succeeded} succeeded</span>
                {result.failed > 0 && <span className="text-xs font-bold text-red">{result.failed} failed</span>}
              </div>
              <div className="max-h-56 overflow-y-auto custom-scrollbar border border-border rounded-xl divide-y divide-border">
                {result.results.map((r) => (
                  <div key={r.row} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                    {r.success ? <FiCheckCircle className="text-green shrink-0" /> : <FiXCircle className="text-red shrink-0" />}
                    <span className="text-muted shrink-0">Row {r.row}</span>
                    <span className="text-white-soft truncate flex-1">{r.email ?? '—'}</span>
                    {!r.success && <span className="text-red text-[11px] truncate max-w-[45%]">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-border shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">
            {result ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing || !file}
            className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
