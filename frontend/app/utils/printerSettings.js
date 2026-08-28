const STORAGE_KEY = 'ifixlab_printer_settings';

// Printer selections are tied to the physical POS machine QZ Tray runs on,
// so they live in this browser's localStorage rather than the shared backend.
export function getPrinterSettings() {
  if (typeof window === 'undefined') return { smallTicketPrinter: '', fullReceiptPrinter: '' };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { smallTicketPrinter: stored.smallTicketPrinter || '', fullReceiptPrinter: stored.fullReceiptPrinter || '' };
  } catch {
    return { smallTicketPrinter: '', fullReceiptPrinter: '' };
  }
}

export function setPrinterSettings(next) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
