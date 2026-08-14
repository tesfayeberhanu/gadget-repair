const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function creditCustomerValue(value) {
  if (value === undefined || value === null || value === '') return false;
  return value === true || value === 'true' || value === 'yes' || value === '1' || value === 1;
}

export function invoiceFinancials(invoice) {
  const invoiceTotal = roundMoney(invoice.recognizedRevenue ?? invoice.totalAmount);
  const amountPaid = roundMoney((invoice.payments || [])
    .filter((payment) => !payment.reversedAt)
    .reduce((sum, payment) => sum + Number(payment.amount), 0));
  const balanceDue = roundMoney(Math.max(0, invoiceTotal - amountPaid));
  const paymentStatus = balanceDue === 0 ? 'PAID' : amountPaid <= 0 ? 'UNPAID' : 'PARTIALLY_PAID';
  return { invoiceTotal, amountPaid, balanceDue, paymentStatus };
}

export function canCompleteWithBalance(isCreditSale, balanceDue) {
  return Boolean(isCreditSale) || roundMoney(balanceDue) === 0;
}

export function creditEligibleForDelivery(ticketStatus, isCreditCustomer, isCreditSale) {
  return ticketStatus === 'PICKED_UP' ? Boolean(isCreditSale) : Boolean(isCreditCustomer);
}

export function finalizeInvoiceSnapshot(invoice, { totalAmount, isCreditCustomer, now = new Date() }) {
  if (invoice.revenueRecognizedAt) return invoice;
  const total = roundMoney(totalAmount);
  return {
    ...invoice,
    totalAmount: total,
    status: 'FINALIZED',
    isCreditSale: Boolean(isCreditCustomer),
    recognizedRevenue: total,
    finalizedAt: now,
    revenueRecognizedAt: now,
  };
}

export function accountingTotals(sales) {
  return sales.reduce((totals, sale) => {
    const financials = invoiceFinancials(sale);
    const revenueActive = Boolean(sale.revenueRecognizedAt && !sale.revenueReversedAt && sale.status === 'FINALIZED');
    if (revenueActive) {
      totals.revenue = roundMoney(totals.revenue + Number(sale.recognizedRevenue ?? sale.totalAmount));
      totals.accountsReceivable = roundMoney(totals.accountsReceivable + financials.balanceDue);
    }
    totals.cashCollected = roundMoney(totals.cashCollected + financials.amountPaid);
    return totals;
  }, { revenue: 0, cashCollected: 0, accountsReceivable: 0 });
}
