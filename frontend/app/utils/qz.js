'use client';

let qzPromise = null;

async function loadQz() {
  if (typeof window === 'undefined') throw new Error('QZ Tray is only available in the browser');
  if (!qzPromise) {
    qzPromise = import('qz-tray').then((mod) => {
      const qz = mod.default || mod;
      // Unsigned/demo mode: QZ Tray shows a one-time "allow this site" prompt per
      // connection instead of validating a certificate. See README for how to move
      // to a signed certificate for unattended production printing.
      qz.security.setCertificatePromise((resolve) => resolve());
      qz.security.setSignaturePromise(() => (resolve) => resolve());
      return qz;
    });
  }
  return qzPromise;
}

export async function ensureQzConnected() {
  const qz = await loadQz();
  if (!qz.websocket.isActive()) await qz.websocket.connect();
  return qz;
}

export async function isQzAvailable() {
  try { await ensureQzConnected(); return true; }
  catch { return false; }
}

export async function listQzPrinters() {
  const qz = await ensureQzConnected();
  return qz.printers.find();
}

export async function printHtmlToPrinter(printerName, html) {
  if (!printerName) throw new Error('No printer selected. Configure it in Settings first.');
  const qz = await ensureQzConnected();
  const config = qz.configs.create(printerName);
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
}
