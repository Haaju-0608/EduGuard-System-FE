import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/** Xuất CSV thật từ data JSON — BE không có endpoint sinh file Excel/PDF, chỉ có report dạng JSON. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Xuất Excel (.xlsx) — dựng workbook ngay trong trình duyệt từ cùng data JSON, không qua BE. */
export function downloadExcel(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, filename);
}

/** Xuất PDF (bảng) — dựng ngay trong trình duyệt bằng jsPDF, không qua BE. */
export function downloadPdf(filename: string, title: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 14, 21);

  const headers = Object.keys(rows[0]);
  const body = rows.map((r) => headers.map((h) => {
    const v = r[h];
    return v === null || v === undefined ? '' : String(v);
  }));

  autoTable(doc, {
    head: [headers],
    body,
    startY: 26,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14, right: 14 },
  });

  doc.save(filename);
}
