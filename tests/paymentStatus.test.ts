import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStripeStatus } from "../src/payments/paymentStatus.ts";
import { reportBucketFor } from "../src/reports/paymentReport.ts";
import { paymentMessageFor } from "../src/notifications/paymentMessage.ts";
import { CheckoutController } from "../src/checkout/CheckoutController.ts";
import { database, resetDatabase } from "../src/database.ts";

test("succeeded provider state is normalized to paid", () => {
  assert.equal(normalizeStripeStatus("succeeded"), "paid");
});

test("processing provider states are normalized to processing", () => {
  assert.equal(normalizeStripeStatus("processing"), "processing");
  assert.equal(normalizeStripeStatus("requires_action"), "processing");
});

test("declined provider state is normalized to failed", () => {
  assert.equal(normalizeStripeStatus("declined"), "failed");
});

test("unknown provider state is treated as processing, never as paid or failed", () => {
  assert.equal(normalizeStripeStatus("some_new_state"), "processing");
  assert.equal(normalizeStripeStatus(""), "processing");
});

test("reports and notifications consume only the normalized status", () => {
  assert.equal(reportBucketFor("paid"), "revenue");
  assert.equal(reportBucketFor("processing"), "awaiting_payment");
  assert.equal(reportBucketFor("failed"), "lost");
  assert.match(paymentMessageFor("processing"), /обробляється/);
});

test("checkout exposes processing without changing the response shape", async () => {
  resetDatabase();
  database.stock.set("book", { productId: "book", available: 5 });

  const response = await new CheckoutController().checkout({
    orderId: "order-proc",
    paymentToken: "proc_card",
    currency: "UAH",
    lines: [{ productId: "book", unitPrice: 100, quantity: 1 }],
  });

  assert.deepEqual(response, {
    orderId: "order-proc",
    status: "payment_pending",
    total: 120,
    paymentStatus: "processing",
  });
});