import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (amount) => {
  if (amount == null) return 'N/A';
  return `Rs. ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generate a professional PDF report for a field officer valuation submission.
 */
export function generateValuationPDF(valuation, projectTitle) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // --- Header ---
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('AUDITRA', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Valuation & Property Consultants', margin, 26);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('VALUATION REPORT', pageWidth - margin, 18, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const category = valuation.category_display || valuation.category || 'N/A';
  doc.text(category.charAt(0).toUpperCase() + category.slice(1) + ' Valuation', pageWidth - margin, 26, { align: 'right' });

  y = 50;

  // --- Report Info Bar ---
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Valuation ID: ${valuation.id || '-'}`, margin + 4, y + 7);
  doc.text(`Submitted: ${formatDate(valuation.submitted_at || valuation.created_at)}`, pageWidth - margin - 4, y + 7, { align: 'right' });

  y += 18;

  // --- Project & Officer Details ---
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Details', margin, y);
  y += 2;

  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const colLeft = margin;
  const colRight = pageWidth / 2 + 10;

  doc.setFontSize(9);

  // Row 1: Project & Field Officer
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Project', colLeft, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  const projTitle = String(projectTitle || valuation.project_title || '-');
  doc.text(projTitle.length > 40 ? projTitle.substring(0, 37) + '...' : projTitle, colLeft + 30, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Field Officer', colRight, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(String(valuation.field_officer_name || valuation.field_officer_username || '-'), colRight + 30, y);
  y += 8;

  // Row 2: Category & Estimated Value
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Category', colLeft, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(String(valuation.category_display || valuation.category || '-'), colLeft + 30, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Status', colRight, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(String(valuation.status_display || valuation.status || '-'), colRight + 30, y);
  y += 14;

  // --- Estimated Value Box ---
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, y, pageWidth - 2 * margin, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Estimated Value', margin + 8, y + 9);
  doc.setFontSize(13);
  doc.text(formatCurrency(valuation.estimated_value), pageWidth - margin - 8, y + 9, { align: 'right' });

  y += 22;

  // --- Category Specific Details ---
  const categoryTitle = getCategoryTitle(valuation.category);
  const categoryRows = getCategoryDetails(valuation);

  if (categoryRows.length > 0) {
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(categoryTitle, margin, y);
    y += 2;
    doc.setDrawColor(30, 58, 138);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Property', 'Details']],
      body: categoryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // --- Description ---
  if (valuation.description) {
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', margin, y);
    y += 2;
    doc.setDrawColor(30, 58, 138);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(valuation.description, pageWidth - 2 * margin);
    doc.text(descLines, margin, y);
    y += descLines.length * 4.5 + 6;
  }

  // --- Notes ---
  if (valuation.notes) {
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', margin, y);
    y += 2;
    doc.setDrawColor(30, 58, 138);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(valuation.notes, pageWidth - 2 * margin);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.5 + 6;
  }

  // --- Photos Section ---
  const photos = valuation.photos || [];
  if (photos.length > 0) {
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Attached Photos', margin, y);
    y += 2;
    doc.setDrawColor(30, 58, 138);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`${photos.length} photo(s) attached to this valuation.`, margin, y);
    y += 5;

    photos.forEach((photo, index) => {
      if (photo.caption) {
        doc.text(`  ${index + 1}. ${photo.caption}`, margin, y);
        y += 4.5;
      }
    });
    y += 4;
  }

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

function getCategoryTitle(category) {
  switch (category) {
    case 'land': return 'Land Details';
    case 'building': return 'Building Details';
    case 'vehicle': return 'Vehicle Details';
    case 'other': return 'Asset Details';
    default: return 'Details';
  }
}

function getCategoryDetails(v) {
  const rows = [];
  switch (v.category) {
    case 'land':
      if (v.land_area) rows.push(['Area', `${v.land_area} sqft`]);
      if (v.land_type) rows.push(['Land Type', v.land_type]);
      if (v.land_location) rows.push(['Location', v.land_location]);
      if (v.land_latitude && v.land_longitude) {
        rows.push(['GPS Coordinates', `${v.land_latitude}, ${v.land_longitude}`]);
      }
      break;
    case 'building':
      if (v.building_area) rows.push(['Area', `${v.building_area} sqft`]);
      if (v.building_type) rows.push(['Building Type', v.building_type]);
      if (v.number_of_floors) rows.push(['Number of Floors', String(v.number_of_floors)]);
      if (v.year_built) rows.push(['Year Built', String(v.year_built)]);
      if (v.building_location) rows.push(['Location', v.building_location]);
      if (v.building_latitude && v.building_longitude) {
        rows.push(['GPS Coordinates', `${v.building_latitude}, ${v.building_longitude}`]);
      }
      break;
    case 'vehicle':
      if (v.vehicle_make || v.vehicle_model) rows.push(['Make / Model', `${v.vehicle_make || ''} ${v.vehicle_model || ''}`.trim()]);
      if (v.vehicle_year) rows.push(['Year', String(v.vehicle_year)]);
      if (v.vehicle_registration_number) rows.push(['Registration No.', v.vehicle_registration_number]);
      if (v.vehicle_mileage) rows.push(['Mileage', `${v.vehicle_mileage} km`]);
      if (v.vehicle_condition) rows.push(['Condition', v.vehicle_condition]);
      break;
    case 'other':
      if (v.other_type) rows.push(['Type', v.other_type]);
      if (v.other_specifications) rows.push(['Specifications', v.other_specifications]);
      break;
  }
  return rows;
}

/**
 * Open a valuation report PDF in a new browser tab.
 */
export function viewValuationPDF(valuation, projectTitle) {
  try {
    const doc = generateValuationPDF(valuation, projectTitle);
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } catch (err) {
    console.error('Failed to view valuation PDF:', err);
    alert('Failed to generate PDF. Please try again.');
  }
}

/**
 * Download a valuation report as a PDF file.
 */
export function downloadValuationPDF(valuation, projectTitle) {
  try {
    const doc = generateValuationPDF(valuation, projectTitle);
    const category = valuation.category || 'valuation';
    const fileName = `Valuation_${category}_${valuation.id || 'report'}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('Failed to download valuation PDF:', err);
    alert('Failed to generate PDF. Please try again.');
  }
}
