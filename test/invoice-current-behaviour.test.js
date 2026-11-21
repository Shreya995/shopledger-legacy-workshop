var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice uses the same HSN GST and billed total as order pricing', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, '');
  var order = {
    id: 7,
    items: items,
    subtotal: orderTotals.subtotal,
    discount: orderTotals.discount,
    tax: orderTotals.tax,
    total: orderTotals.total
  };
  var invoiceTotals = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceTotals.rows[0].gstPercent, 5);
  assert.equal(invoiceTotals.rows[0].lineTax, 32);
  assert.equal(invoiceTotals.tax, orderTotals.tax);
  assert.equal(invoiceTotals.total, orderTotals.total);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice preserves the HSN-based GST rate used by order pricing', function () {
  // Mirrors the line shape persisted by routes/orders.js (including HSN, no gstRate).
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, '');
  var order = {
    id: 7,
    items: items,
    subtotal: orderTotals.subtotal,
    discount: orderTotals.discount,
    tax: orderTotals.tax,
    total: orderTotals.total
  };
  var invoiceTotals = invoice.computeInvoiceFigures(order);

  assert.equal(orderTotals.lines[0].gstPercent, 5);
  assert.equal(orderTotals.tax, 5);
  assert.equal(orderTotals.total, 105);
  assert.equal(invoiceTotals.rows[0].gstPercent, 5);
  assert.equal(invoiceTotals.tax, 5);
  assert.equal(invoiceTotals.total, 105);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the same capped coupon discount and post-discount GST as order pricing', function () {
  var items = [{ id: 2, name: 'Coffee', sku: 'COF', hsn: '0901', price: 2000, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 8,
    items: items,
    coupon: 'SAVE10',
    subtotal: orderTotals.subtotal,
    discount: orderTotals.discount,
    tax: orderTotals.tax,
    total: orderTotals.total
  };
  var invoiceTotals = invoice.computeInvoiceFigures(order);

  assert.equal(orderTotals.discount, 150);
  assert.equal(orderTotals.taxable, 1850);
  assert.equal(orderTotals.total, 2183);
  assert.equal(invoiceTotals.discount, 150);
  assert.equal(invoiceTotals.tax, 333);
  assert.equal(invoiceTotals.total, 2183);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('GST reconciliation reports matching invoice and saved order totals', function () {
  var items = [{ id: 3, name: 'Dal', sku: 'DAL', hsn: '0713', price: 100, qty: 1 }];
  var totals = pricing.computeTotals(items, '');
  var db = {
    orders: [{
      id: 9,
      date: '2026-11-21',
      status: 'completed',
      items: items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total
    }]
  };
  var reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 5);
  assert.equal(reconciliation.rows[0].invoiceTax, 5);
  assert.equal(reconciliation.rows[0].ledgerTotal, 105);
  assert.equal(reconciliation.rows[0].invoiceTotal, 105);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
