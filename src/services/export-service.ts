import { toPng } from 'html-to-image';

import { formatLongDate, getMonthLabel } from '@/utils/dates';

import type { EntryRecord } from '@/types/entry';

let pdfDependenciesPromise: Promise<typeof import('@/lib/pdf-export-client')> | null = null;

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function renderCalendarSnapshot(element: HTMLElement) {
  return toPng(element, {
    backgroundColor: '#fffaf4',
    pixelRatio: 2.5,
    cacheBust: true,
  });
}

export async function exportCalendarImage(element: HTMLElement, year: number) {
  const imageUrl = await renderCalendarSnapshot(element);
  downloadDataUrl(imageUrl, `calendario-emocional-${year}.png`);
}

async function loadPdfDependencies() {
  if (!pdfDependenciesPromise) {
    pdfDependenciesPromise = import('@/lib/pdf-export-client');
  }

  try {
    return await pdfDependenciesPromise;
  } catch (error) {
    pdfDependenciesPromise = null;

    if (error instanceof TypeError && error.message.includes('Failed to fetch dynamically imported module')) {
      throw new Error('No se pudo preparar el exportador PDF en desarrollo. Recarga la página e inténtalo de nuevo.');
    }

    throw error;
  }
}

function groupEntriesByMonth(year: number, entries: EntryRecord[]) {
  const groupedEntries = new Map<number, EntryRecord[]>();

  for (const entry of [...entries].sort((left, right) => left.date.localeCompare(right.date))) {
    const month = Number.parseInt(entry.date.slice(5, 7), 10) - 1;
    const current = groupedEntries.get(month) ?? [];
    current.push(entry);
    groupedEntries.set(month, current);
  }

  return Array.from(groupedEntries.entries())
    .sort(([leftMonth], [rightMonth]) => leftMonth - rightMonth)
    .map(([month, monthEntries]) => ({
      month,
      label: getMonthLabel(year, month),
      entries: monthEntries,
    }));
}

function drawPageFooter(pdfDocument: InstanceType<typeof import('jspdf').default>) {
  const totalPages = pdfDocument.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    pdfDocument.setPage(page);
    const pageWidth = pdfDocument.internal.pageSize.getWidth();
    const pageHeight = pdfDocument.internal.pageSize.getHeight();
    pdfDocument.setFont('helvetica', 'normal');
    pdfDocument.setFontSize(9);
    pdfDocument.setTextColor(110, 92, 78);
    pdfDocument.text(`Página ${page} de ${totalPages}`, pageWidth - 30, pageHeight - 8);
  }
}

export async function exportCalendarPdf(element: HTMLElement, year: number, entries: EntryRecord[]) {
  const { jsPDF, autoTable } = await loadPdfDependencies();
  const imageUrl = await renderCalendarSnapshot(element);
  const pdfDocument = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const monthGroups = groupEntriesByMonth(year, entries);

  pdfDocument.setFillColor(255, 250, 244);
  pdfDocument.rect(0, 0, pdfDocument.internal.pageSize.getWidth(), pdfDocument.internal.pageSize.getHeight(), 'F');

  pdfDocument.setFont('helvetica', 'bold');
  pdfDocument.setFontSize(24);
  pdfDocument.setTextColor(61, 42, 31);
  pdfDocument.text('Calendario emocional', 14, 16);
  pdfDocument.setFont('helvetica', 'normal');
  pdfDocument.setFontSize(11);
  pdfDocument.setTextColor(110, 92, 78);
  pdfDocument.text(`Resumen anual ${year}`, 14, 23);

  const firstPageWidth = pdfDocument.internal.pageSize.getWidth();
  const firstPageHeight = pdfDocument.internal.pageSize.getHeight();
  const imageProperties = pdfDocument.getImageProperties(imageUrl);
  const availableWidth = firstPageWidth - 20;
  const availableHeight = firstPageHeight - 38;
  const imageScale = Math.min(availableWidth / imageProperties.width, availableHeight / imageProperties.height);
  const renderedWidth = imageProperties.width * imageScale;
  const renderedHeight = imageProperties.height * imageScale;
  const imageX = (firstPageWidth - renderedWidth) / 2;
  const imageY = 29 + ((availableHeight - renderedHeight) / 2);

  pdfDocument.addImage(imageUrl, 'PNG', imageX, imageY, renderedWidth, renderedHeight, undefined, 'FAST');

  for (const monthGroup of monthGroups) {
    pdfDocument.addPage('a4', 'portrait');
    const pageWidth = pdfDocument.internal.pageSize.getWidth();

    pdfDocument.setFillColor(255, 250, 244);
    pdfDocument.rect(0, 0, pageWidth, pdfDocument.internal.pageSize.getHeight(), 'F');
    pdfDocument.setFont('helvetica', 'bold');
    pdfDocument.setFontSize(20);
    pdfDocument.setTextColor(61, 42, 31);
    pdfDocument.text(monthGroup.label.charAt(0).toUpperCase() + monthGroup.label.slice(1), 14, 18);
    pdfDocument.setFont('helvetica', 'normal');
    pdfDocument.setFontSize(10);
    pdfDocument.setTextColor(110, 92, 78);
    pdfDocument.text(`${monthGroup.entries.length} día${monthGroup.entries.length === 1 ? '' : 's'} registrado${monthGroup.entries.length === 1 ? '' : 's'}`, 14, 25);

    autoTable(pdfDocument, {
      startY: 32,
      head: [['Fecha', 'Emociones', 'Nota']],
      body: monthGroup.entries.map((entry) => [
        formatLongDate(entry.date),
        entry.emotions.map((emotion) => emotion.name).join(', '),
        entry.note.trim() || 'Sin nota',
      ]),
      styles: {
        fontSize: 10,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'top',
        textColor: [61, 42, 31],
        lineColor: [236, 220, 207],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [143, 93, 61],
        textColor: [255, 250, 244],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [255, 253, 250],
      },
      bodyStyles: {
        fillColor: [255, 250, 244],
      },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 52 },
        2: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14, bottom: 16 },
    });
  }

  drawPageFooter(pdfDocument);

  pdfDocument.save(`calendario-emocional-${year}.pdf`);
}