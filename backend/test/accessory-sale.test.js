import test from 'node:test';
import assert from 'node:assert/strict';
import { accessoryRevenueFromSales, matchesAccessorySale, prepareAccessorySale } from '../src/accessory-sale.js';

const request = (items) => ({
  items,
  paymentMethod: 'CASH',
  idempotencyKey: 'checkout-12345678',
});

test('SKU sales use cashier-entered prices for the invoice total', () => {
  const prepared = prepareAccessorySale(request([
    { sku: ' cab-01 ', quantity: 2, unitPrice: '37.50' },
    { sku: 'chg-02', quantity: 1, unitPrice: '120' },
  ]));
  assert.deepEqual(prepared.items.map(({ sku, quantity, unitPrice }) => ({ sku, quantity, unitPrice })), [
    { sku: 'CAB-01', quantity: 2, unitPrice: '37.50' },
    { sku: 'CHG-02', quantity: 1, unitPrice: '120.00' },
  ]);
  assert.equal(prepared.totalAmount, '195.00');
});

test('sales reject missing prices, invalid quantities and duplicate SKUs', () => {
  for (const items of [
    [{ sku: 'CAB-01', quantity: 1, unitPrice: '' }],
    [{ sku: 'CAB-01', quantity: 0, unitPrice: '10' }],
    [{ sku: 'CAB-01', quantity: 1, unitPrice: '10.999' }],
    [{ sku: 'CAB-01', quantity: 1, unitPrice: '10' }, { sku: 'cab-01', quantity: 1, unitPrice: '20' }],
  ]) assert.throws(() => prepareAccessorySale(request(items)), { message: 'INVALID_ACCESSORY_SALE' });
});

test('a repeated checkout key must refer to the same items and price', () => {
  const prepared = prepareAccessorySale(request([{ sku: 'CAB-01', quantity: 2, unitPrice: '37.50' }]));
  const sale = { paymentMethod: 'CASH', totalAmount: '75.00', items: [{ sku: 'CAB-01', quantity: 2, unitPrice: '37.50' }] };
  assert.equal(matchesAccessorySale(sale, prepared), true);
  assert.equal(matchesAccessorySale({ ...sale, items: [{ ...sale.items[0], unitPrice: '40.00' }] }, prepared), false);
});

test('accessory revenue includes only active finalized retail sales', () => {
  const sale = {
    ticketId: null, status: 'FINALIZED', revenueRecognizedAt: new Date(), revenueReversedAt: null,
    items: [{ category: 'Accessory', quantity: 2, unitPrice: '37.50' }, { category: 'Cable', quantity: 1, unitPrice: '12.25' }],
  };
  assert.equal(accessoryRevenueFromSales([sale]), 87.25);
  assert.equal(accessoryRevenueFromSales([{ ...sale, status: 'REFUNDED' }, { ...sale, ticketId: 'repair-1' }]), 0);
});
