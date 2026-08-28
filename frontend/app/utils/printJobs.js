'use client';

import { renderToStaticMarkup } from 'react-dom/server';
import { ReceiptDocument } from '../print-ticket/page';
import { SmallTicketDocument } from '../components/print/SmallTicket';
import { printHtmlToPrinter } from './qz';
import { getPrinterSettings } from './printerSettings';

function collectStylesheetCss() {
  return Array.from(document.styleSheets).map((sheet) => {
    try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n'); }
    catch { return ''; } // cross-origin stylesheets can't be read; nothing we render needs them
  }).join('\n');
}

// QZ Tray renders this HTML in its own engine, not in this page, so it needs to be a
// fully self-contained document: the currently loaded stylesheets inlined, and a <base>
// so relative asset URLs (like the logo) still resolve.
function buildStandaloneHtml(bodyMarkup) {
  const css = collectStylesheetCss();
  const base = window.location.origin;
  return `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/"><style>${css}</style></head><body>${bodyMarkup}</body></html>`;
}

const asArray = (ticketOrTickets) => Array.isArray(ticketOrTickets) ? ticketOrTickets : [ticketOrTickets];

export async function printSmallTicket(ticketOrTickets, printerNameOverride) {
  const printerName = printerNameOverride || getPrinterSettings().smallTicketPrinter;
  for (const ticket of asArray(ticketOrTickets)) {
    const html = buildStandaloneHtml(renderToStaticMarkup(<SmallTicketDocument ticket={ticket}/>));
    await printHtmlToPrinter(printerName, html);
  }
}

export async function printFullReceipt(ticketOrTickets, printerNameOverride) {
  const printerName = printerNameOverride || getPrinterSettings().fullReceiptPrinter;
  const html = buildStandaloneHtml(renderToStaticMarkup(<ReceiptDocument tickets={asArray(ticketOrTickets)}/>));
  await printHtmlToPrinter(printerName, html);
}

// Printer 1 (small tag per device) then Printer 2 (one shared customer receipt).
export async function printBoth(ticketOrTickets) {
  await printSmallTicket(ticketOrTickets);
  await printFullReceipt(ticketOrTickets);
}
