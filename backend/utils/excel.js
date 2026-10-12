import ExcelJS from 'exceljs';

/**
 * ExcelJS Streaming Workbook Generation Engine for Workflow G
 * Generates and streams a landscape formatted .xlsx report directly to the HTTP response stream.
 * 
 * Requirements:
 * - Landscape orientation with frozen top header row.
 * - Dark slate styled header row (#1E293B) with white bold text.
 * - Structured columns: Reg ID, Full Name, Register Number, Residency, Phone, Department, Section, Year, Gender, Payment Status, Verification Status, Transaction ID, Rejection Reason, Registered Date, Verified Date, Payment Proof URL.
 * - Thin light borders on all data cells.
 * - Streams workbook directly as binary response (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet).
 * - Automatic filename: Team_Registrations_<STATUS>_<RESIDENCY>_<YYYY-MM-DD>.xlsx.
 */
export async function streamRegistrationsExcel(registrations, res, options = {}) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const statusPart = (options.status || 'ALL').toUpperCase().replace(/\s+/g, '_');
  const residencyPart = (options.residency || 'ALL').toUpperCase().replace(/\s+/g, '_');
  const filename = `Team_Registrations_${statusPart}_${residencyPart}_${dateStr}.xlsx`;

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
    useSharedStrings: true
  });

  // Landscape orientation with frozen top header row
  const worksheet = workbook.addWorksheet('Team Registrations', {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9 // A4
    },
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  // 16 Structured Columns as specified in Workflow G
  worksheet.columns = [
    { header: 'Reg ID', key: 'regId', width: 20 },
    { header: 'Full Name', key: 'fullName', width: 25 },
    { header: 'Register Number', key: 'registerNumber', width: 22 },
    { header: 'Residency', key: 'residency', width: 16 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Section', key: 'section', width: 12 },
    { header: 'Year', key: 'year', width: 14 },
    { header: 'Gender', key: 'gender', width: 12 },
    { header: 'Payment Status', key: 'paymentStatus', width: 16 },
    { header: 'Verification Status', key: 'verificationStatus', width: 20 },
    { header: 'Transaction ID', key: 'transactionId', width: 24 },
    { header: 'Rejection Reason', key: 'rejectionReason', width: 35 },
    { header: 'Registered Date', key: 'registeredDate', width: 22 },
    { header: 'Verified Date', key: 'verifiedDate', width: 22 },
    { header: 'Payment Proof URL', key: 'proofUrl', width: 45 }
  ];

  // Dark slate styled header row (#1E293B) with white bold text
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Dark Slate #1E293B
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' } // White bold text
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });
  headerRow.commit();

  let rowIndex = 2;
  for (const reg of registrations) {
    const regId = reg.registrationId || reg.id || 'N/A';
    const fullName = reg.fullName || reg.name || 'N/A';
    const registerNumber = reg.registerNumber || reg.regNo || 'N/A';
    const residency = reg.residency || reg.residencyStatus || 'Dayscholar';
    const phone = reg.phone || 'N/A';
    const department = reg.department || reg.branch || 'CSE';
    const section = reg.section || 'A';
    const year = reg.year || reg.academicYear || '1st Year';
    const gender = reg.gender || 'N/A';
    const paymentStatus = (reg.paymentStatus || (reg.status === 'PENDING_PAYMENT' ? 'UNPAID' : 'PAID')).toUpperCase();
    const verificationStatus = (reg.verificationStatus || (reg.status === 'VERIFIED' ? 'VERIFIED' : reg.status === 'REJECTED' ? 'REJECTED' : 'PENDING')).toUpperCase();
    const transactionId = reg.transactionId || reg.txnId || 'N/A';
    const rejectionReason = reg.rejectionReason || (verificationStatus === 'REJECTED' ? reg.adminNotes : '') || '';
    
    // Dates formatting
    const registeredDate = (reg.registeredAt || reg.createdAt)
      ? new Date(reg.registeredAt || reg.createdAt).toISOString().replace('T', ' ').slice(0, 19)
      : new Date().toISOString().replace('T', ' ').slice(0, 19);

    const verifiedDate = reg.verifiedAt
      ? new Date(reg.verifiedAt).toISOString().replace('T', ' ').slice(0, 19)
      : (verificationStatus === 'VERIFIED' || verificationStatus === 'REJECTED') && reg.updatedAt
        ? new Date(reg.updatedAt).toISOString().replace('T', ' ').slice(0, 19)
        : 'N/A';

    const proofUrl =
      reg.paymentScreenshot?.url ||
      reg.proofUrl ||
      reg.idProof ||
      (reg.screenshotPath ? `http://localhost:5000/${reg.screenshotPath.replace(/^public\//, '')}` : 'N/A');

    const row = worksheet.addRow({
      regId,
      fullName,
      registerNumber,
      residency,
      phone,
      department,
      section,
      year,
      gender,
      paymentStatus,
      verificationStatus,
      transactionId,
      rejectionReason,
      registeredDate,
      verifiedDate,
      proofUrl
    });

    row.height = 22;

    const isEven = rowIndex % 2 === 0;
    row.eachCell((cell, colNumber) => {
      // Subtle zebra striping for data legibility
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      }

      cell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: 'FF0F172A' }
      };

      // Alignment: center codes/dates/status, left-align text
      const centerCols = [1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15];
      cell.alignment = {
        vertical: 'middle',
        horizontal: centerCols.includes(colNumber) ? 'center' : 'left'
      };

      // Thin light borders on all data cells
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Highlight status cells
      if (colNumber === 10) { // Payment Status
        if (cell.value === 'PAID') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
        } else {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD97706' } };
        }
      } else if (colNumber === 11) { // Verification Status
        if (cell.value === 'VERIFIED') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
        } else if (cell.value === 'REJECTED') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
        } else {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB45309' } };
        }
      }
    });

    row.commit();
    rowIndex++;
  }

  await worksheet.commit();
  await workbook.commit();
}
