const cents = (value) => {
  const text = String(value ?? '').trim();
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(text)) throw new Error('INVALID_ACCESSORY_SALE');
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount < 1) throw new Error('INVALID_ACCESSORY_SALE');
  return amount;
};

export function prepareAccessorySale(input) {
  const items = input?.items;
  const method = String(input?.paymentMethod || '');
  const idempotencyKey = String(input?.idempotencyKey || '').trim();
  if (!Array.isArray(items) || items.length < 1 || items.length > 30
    || !['CASH', 'CARD', 'DIGITAL_TRANSFER'].includes(method)
    || !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) throw new Error('INVALID_ACCESSORY_SALE');

  const seen = new Set();
  let totalCents = 0;
  const lines = items.map((item) => {
    const sku = String(item?.sku || '').trim().toUpperCase();
    const quantity = Number(item?.quantity);
    if (!sku || sku.length > 64 || seen.has(sku) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error('INVALID_ACCESSORY_SALE');
    seen.add(sku);
    const unitCents = cents(item?.unitPrice);
    totalCents += quantity * unitCents;
    if (totalCents > 9_999_999_999) throw new Error('INVALID_ACCESSORY_SALE');
    return { sku, quantity, unitPrice: (unitCents / 100).toFixed(2), unitCents };
  });
  return { items: lines, totalAmount: (totalCents / 100).toFixed(2), paymentMethod: method, idempotencyKey };
}

export function matchesAccessorySale(sale, prepared) {
  if (sale.paymentMethod !== prepared.paymentMethod || Number(sale.totalAmount) !== Number(prepared.totalAmount)
    || sale.items.length !== prepared.items.length) return false;
  const existing = new Map(sale.items.map((item) => [item.sku, item]));
  return prepared.items.every((line) => {
    const item = existing.get(line.sku);
    return item && item.quantity === line.quantity && Number(item.unitPrice) === Number(line.unitPrice);
  });
}

export function accessoryRevenueFromSales(sales) {
  // Every SaleItem is created exclusively by createAccessorySale, which only ever
  // accepts parts whose category belongs to the ACCESSORY group, so no further
  // category filtering is needed here.
  const total = sales
    .filter((sale) => !sale.ticketId && sale.status === 'FINALIZED' && sale.revenueRecognizedAt && !sale.revenueReversedAt)
    .flatMap((sale) => sale.items || [])
    .reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0);
  return Math.round(total * 100) / 100;
}
