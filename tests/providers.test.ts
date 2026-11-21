import test from "node:test";
import assert from "node:assert/strict";
import { CheckoutController } from "../src/checkout/CheckoutController.ts";
import { createPaymentGateway, type PaymentProvider } from "../src/payments/index.ts";
import { normalizeLocalPayStatus } from "../src/payments/internal/localpay/localPayStatus.ts";
import { database, resetDatabase } from "../src/database.ts";
import { auditLog, runtimeConfig } from "../src/config.ts";

const providers: PaymentProvider[] = ["stripe", "localpay"];

const cases = [
  { token: "tok_valid", paymentStatus: "paid", status: "confirmed" },
  { token: "proc_card", paymentStatus: "processing", status: "payment_pending" },
  { token: "fail_card", paymentStatus: "failed", status: "payment_pending" },
] as const;

test.beforeEach(() => {
  resetDatabase();
  auditLog.length = 0;
  runtimeConfig.taxRate = 0.2;
  runtimeConfig.discountPercent = 0;
  database.stock.set("book", { productId: "book", available: 50 });
});

test.afterEach(() => {
  runtimeConfig.paymentProvider = "stripe";
});

for (const provider of providers) {
  for (const c of cases) {
    test(`${provider}: checkout returns ${c.paymentStatus} through the unchanged public API`, async () => {
      runtimeConfig.paymentProvider = provider;

      const response = await new CheckoutController().checkout({
        orderId: `order-${provider}-${c.paymentStatus}`,
        paymentToken: c.token,
        currency: "UAH",
        lines: [{ productId: "book", unitPrice: 100.25, quantity: 1 }],
      });

      assert.deepEqual(response, {
        orderId: `order-${provider}-${c.paymentStatus}`,
        status: c.status,
        total: 120.3,
        paymentStatus: c.paymentStatus,
      });
    });
  }
}

test("both adapters return the same neutral result shape", async () => {
  for (const provider of providers) {
    const result = await createPaymentGateway(provider).authorize({
      orderId: "o-1",
      amountMinor: 12030,
      currency: "UAH",
      paymentToken: "tok_valid",
    });
    assert.deepEqual(Object.keys(result).sort(), ["paymentId", "status"]);
    assert.equal(result.status, "paid");
  }
});

test("LocalPay normalization covers its own status names and unknown values", () => {
  assert.equal(normalizeLocalPayStatus("OK"), "paid");
  assert.equal(normalizeLocalPayStatus("WAIT"), "processing");
  assert.equal(normalizeLocalPayStatus("REJECT"), "failed");
  assert.equal(normalizeLocalPayStatus("SOMETHING_NEW"), "processing");
});

test("unknown provider name fails fast at configuration time", () => {
  assert.throws(() => createPaymentGateway("paypal" as PaymentProvider), /Unknown payment provider/);
});