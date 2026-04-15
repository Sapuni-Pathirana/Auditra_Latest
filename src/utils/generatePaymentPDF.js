import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import logoUrl from '../assets/logo.png';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatLKR = (amount) => {
  if (amount == null) return 'LKR 0.00';
  return `LKR ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Pre-load logo as base64 for PDF embedding
let logoBase64 = null;
let logoWidth = 0;
let logoHeight = 0;
const logoReady = new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    logoWidth = img.width;
    logoHeight = img.height;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    logoBase64 = canvas.toDataURL('image/png');
    resolve(logoBase64);
  };
  img.onerror = () => resolve(null);
  img.src = logoUrl;
});

/**
 * Generate a professional PDF payment slip for a single employee.
 */
export async function generatePaymentSlipPDF(slip) {
  if (!logoBase64) await logoReady;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // --- Header ---
  // Light grey background for logo area
  doc.setFillColor(243, 244, 249); // #F3F4F9
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Logo
  if (logoBase64) {
    const logoH = 22;
    const logoW = logoHeight > 0 ? (logoWidth / logoHeight) * logoH : 50;
    doc.addImage(logoBase64, 'PNG', margin, 6, logoW, logoH);
  }

  // Payment Slip title in the header area
  doc.setTextColor(47, 122, 244);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT SLIP', pageWidth - margin, 16, { align: 'right' });

  // Month/year in the header area
  const monthName = slip.month_display || MONTH_NAMES[slip.month] || String(slip.month);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${monthName} ${slip.year}`, pageWidth - margin, 24, { align: 'right' });

  y = 40;

  // --- Slip Info Bar ---
  doc.setTextColor(47, 122, 244);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pay Slip No: ${slip.pay_slip_number || '-'}`, margin, y + 7);
  const genDate = slip.generated_at
    ? new Date(slip.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '-';
  doc.text(`Generated: ${genDate}`, pageWidth - margin, y + 7, { align: 'right' });

  y += 18;

  // --- Employee Details ---
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Details', margin, y);
  y += 2;

  doc.setDrawColor(47, 122, 244);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(9);
  const empName = String(slip.user_full_name || slip.user_username || '-');
  const empNo = String(slip.employee_number || '-');
  const empRole = String(slip.role_display || slip.role || '-');

  const colLeft = margin;
  const colRight = pageWidth / 2 + 10;

  // Row 1
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Employee Name', colLeft, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(empName, colLeft + 35, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Employee No', colRight, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(empNo, colRight + 35, y);
  y += 8;

  // Row 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Designation', colLeft, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(empRole, colLeft + 35, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Pay Period', colRight, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(`${monthName} ${slip.year}`, colRight + 35, y);
  y += 14;

  // --- Salary Breakdown Table ---
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Salary Breakdown', margin, y);
  y += 2;
  doc.setDrawColor(47, 122, 244);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  const basicSalary = Number(slip.salary) || 0;
  const allowances = Number(slip.allowances) || 0;
  const overtimePay = Number(slip.overtime_pay) || 0;
  const overtimeHours = Number(slip.overtime_hours) || 0;
  const epf = Number(slip.epf_contribution) || 0;
  const netSalary = Number(slip.net_salary) || 0;
  const totalEarnings = basicSalary + allowances + overtimePay;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Description', 'Amount']],
    body: [
      ['Basic Salary', formatLKR(basicSalary)],
      ['Allowances', formatLKR(allowances)],
      [`Overtime Pay (${overtimeHours} hrs)`, formatLKR(overtimePay)],
      [{ content: 'Total Earnings', styles: { fontStyle: 'bold' } },
       { content: formatLKR(totalEarnings), styles: { fontStyle: 'bold' } }],
      [{ content: '', colSpan: 2, styles: { fillColor: [255, 255, 255], minCellHeight: 2 } }],
      [{ content: 'DEDUCTIONS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [254, 242, 242], textColor: [185, 28, 28] } }],
      ['EPF Contribution (8%)', formatLKR(epf)],
      [{ content: 'Total Deductions', styles: { fontStyle: 'bold' } },
       { content: formatLKR(epf), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [47, 122, 244],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 50, halign: 'right' },
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // --- Net Salary Box ---
  doc.setFillColor(47, 122, 244);
  doc.rect(margin, y, pageWidth - 2 * margin, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Net Salary', margin + 8, y + 11);
  doc.setFontSize(14);
  doc.text(formatLKR(netSalary), pageWidth - margin - 8, y + 11, { align: 'right' });

  y += 28;

  // --- Footer ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a system-generated document. No signature is required.', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Generated by Auditra ERP System', pageWidth / 2, y, { align: 'center' });

  return doc;
}

/**
 * Download a payment slip as a PDF file.
 */
export async function downloadPaymentSlipPDF(slip) {
  try {
    const doc = await generatePaymentSlipPDF(slip);
    const monthName = slip.month_display || MONTH_NAMES[slip.month] || String(slip.month);
    const fileName = `PaySlip_${slip.user_username || slip.employee_number || 'employee'}_${monthName}_${slip.year}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('Failed to download payment slip PDF:', err);
    alert('Failed to generate PDF. Please try again.');
  }
}

/**
 * Open a payment slip PDF in a new browser tab for viewing.
 */
export async function viewPaymentSlipPDF(slip) {
  try {
    const doc = await generatePaymentSlipPDF(slip);
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } catch (err) {
    console.error('Failed to view payment slip PDF:', err);
    alert('Failed to generate PDF. Please try again.');
  }
}

/**
 * Download all payment slip PDFs bundled in a single zip file.
 */
export async function downloadAllPaymentSlipPDFs(slips) {
  if (!slips || slips.length === 0) return;

  try {
    const zip = new JSZip();
    const firstSlip = slips[0];
    const monthName = firstSlip.month_display || MONTH_NAMES[firstSlip.month] || String(firstSlip.month);

    for (const slip of slips) {
      const doc = await generatePaymentSlipPDF(slip);
      const pdfBlob = doc.output('blob');
      const slipMonth = slip.month_display || MONTH_NAMES[slip.month] || String(slip.month);
      const fileName = `PaySlip_${slip.user_username || slip.employee_number || 'employee'}_${slipMonth}_${slip.year}.pdf`;
      zip.file(fileName, pdfBlob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `PaymentSlips_${monthName}_${firstSlip.year}.zip`);
  } catch (err) {
    console.error('Failed to generate zip file:', err);
    alert('Failed to generate zip file. Please try again.');
  }
}
