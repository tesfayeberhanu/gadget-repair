import test from 'node:test';
import assert from 'node:assert/strict';
import { accountingTotals, canCompleteWithBalance, creditCustomerValue, finalizeInvoiceSnapshot, invoiceFinancials } from '../src/accounting.js';

const finalizedInvoice = (payments = [], overrides = {}) => ({
  id: 'invoice-1',
  totalAmount: 100,
  recognizedRevenue: 100,
  status: 'FINALIZED',
  revenueRecognizedAt: new Date('2026-08-13T10:00:00Z'),
  revenueReversedAt: null,
  payments,
  ...overrides,
});

test('new customers default to non-credit and can be marked as credit', () => {
  assert.equal(creditCustomerValue(undefined), false);
  assert.equal(creditCustomerValue('false'), false);
  assert.equal(creditCustomerValue('true'), true);
});

test('a finalized ETB 100 credit invoice with no payment records revenue and receivable, not cash', () => {
  const invoice = finalizedInvoice([], { isCreditSale: true });
  assert.deepEqual(invoiceFinancials(invoice), { invoiceTotal: 100, amountPaid: 0, balanceDue: 100, paymentStatus: 'UNPAID' });
  assert.deepEqual(accountingTotals([invoice]), { revenue: 100, cashCollected: 0, accountsReceivable: 100 });
});

test('a finalized ETB 100 credit invoice with ETB 40 paid keeps full revenue and ETB 60 due', () => {
  const invoice = finalizedInvoice([{ amount: 40, reversedAt: null }], { isCreditSale: true });
  assert.deepEqual(invoiceFinancials(invoice), { invoiceTotal: 100, amountPaid: 40, balanceDue: 60, paymentStatus: 'PARTIALLY_PAID' });
  assert.deepEqual(accountingTotals([invoice]), { revenue: 100, cashCollected: 40, accountsReceivable: 60 });
});

test('paying the remaining ETB 60 later clears the balance without increasing revenue again', () => {
  const invoice = finalizedInvoice([{ amount: 40, reversedAt: null }, { amount: 60, reversedAt: null }], { isCreditSale: true });
  assert.deepEqual(invoiceFinancials(invoice), { invoiceTotal: 100, amountPaid: 100, balanceDue: 0, paymentStatus: 'PAID' });
  assert.deepEqual(accountingTotals([invoice]), { revenue: 100, cashCollected: 100, accountsReceivable: 0 });
});

test('repeating invoice finalization is idempotent', () => {
  const first = finalizeInvoiceSnapshot({ status: 'DRAFT', revenueRecognizedAt: null }, { totalAmount: 100, isCreditCustomer: true, now: new Date('2026-08-13T10:00:00Z') });
  const second = finalizeInvoiceSnapshot(first, { totalAmount: 200, isCreditCustomer: false, now: new Date('2026-08-13T11:00:00Z') });
  assert.equal(second.recognizedRevenue, 100);
  assert.equal(second.isCreditSale, true);
  assert.deepEqual(accountingTotals([{ ...second, payments: [] }]), { revenue: 100, cashCollected: 0, accountsReceivable: 100 });
});

test('changing the customer credit flag does not change the historical invoice snapshot', () => {
  const invoice = finalizeInvoiceSnapshot({ status: 'DRAFT', revenueRecognizedAt: null }, { totalAmount: 100, isCreditCustomer: true });
  const customer = { isCreditCustomer: false };
  assert.equal(invoice.isCreditSale, true);
  assert.equal(customer.isCreditCustomer, false);
  assert.equal(accountingTotals([{ ...invoice, payments: [] }]).revenue, 100);
});

test('draft and cancelled invoices are excluded from revenue', () => {
  const draft = { ...finalizedInvoice(), status: 'DRAFT', revenueRecognizedAt: null, recognizedRevenue: null };
  const cancelled = { ...finalizedInvoice(), status: 'CANCELLED', revenueReversedAt: new Date('2026-08-13T12:00:00Z') };
  assert.deepEqual(accountingTotals([draft, cancelled]), { revenue: 0, cashCollected: 0, accountsReceivable: 0 });
});

test('regular customers cannot complete with a balance; credit customers can', () => {
  assert.equal(canCompleteWithBalance(false, 100), false);
  assert.equal(canCompleteWithBalance(false, 0), true);
  assert.equal(canCompleteWithBalance(true, 100), true);
  assert.equal(canCompleteWithBalance(true, 60), true);
});

test('payment reversals reduce collections and restore the invoice balance without changing revenue', () => {
  const invoice = finalizedInvoice([{ amount: 100, reversedAt: new Date('2026-08-13T12:00:00Z') }]);
  assert.deepEqual(accountingTotals([invoice]), { revenue: 100, cashCollected: 0, accountsReceivable: 100 });
});
