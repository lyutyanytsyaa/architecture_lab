import test from "node:test";
import assert from "node:assert/strict";
import { CheckoutController } from "../src/checkout/CheckoutController.ts";
import { Inventory, OutOfStockError } from "../src/inventory/index.ts";
import { OrderService } from "../src/orders/OrderService.ts";
import { createPaymentGateway, type PaymentGateway } from "../src/payments/index.ts";
import { calculateTotal, type CartLine } from "../src/pricing/calculateTotal.ts";
import { database, resetDatabase } from "../src/database.ts";
import { auditLog, runtimeConfig } from "../src/config.ts";

test.beforeEach(() => {
  resetDatabase();
  auditLog.length = 0;
  runtimeConfig.taxRate = 0.2;
  runtimeConfig.discountPercent = 0;
  database.stock.set("book", { productId: "book", available: 5 });
  database.stock.set("pen", { productId: "pen", available: 10 });
});

// ---------- Inventory ownership ----------

test("out-of-stock leaves every stock row unchanged (no partial reservation)", async () => {
  await assert.rejects(
    () => new CheckoutController().checkout({
      orderId: "order-partial",
      paymentToken: "tok_valid",
      currency: "UAH",
      lines: [
        { productId: "pen", unitPrice: 10, quantity: 2 },
        { productId: "book", unitPrice: 100, quantity: 6 },
      ],
    }),
    /Insufficient stock for book/,
  );

  assert.equal(database.stock.get("pen")?.available, 10);
  assert.equal(database.stock.get("book")?.available, 5);
  assert.equal(database.orders.has("order-partial"), false);
});

test("Inventory.reserve is all-or-nothing and reports which product is missing", () => {
  const inventory = new Inventory();
  assert.throws(
    () => inventory.reserve([{ productId: "pen", quantity: 1 }, { productId: "ghost", quantity: 1 }]),
    (error: unknown) => error instanceof OutOfStockError && error.productId === "ghost",
  );
  assert.equal(inventory.availableQuantity("pen"), 10);

  inventory.reserve([{ productId: "pen", quantity: 3 }, { productId: "book", quantity: 5 }]);
  assert.equal(inventory.availableQuantity("pen"), 7);
  assert.equal(inventory.availableQuantity("book"), 0);
});

test("Inventory counts repeated lines of the same product together", () => {
  const inventory = new Inventory();
  assert.throws(
    () => inventory.reserve([{ productId: "book", quantity: 3 }, { productId: "book", quantity: 3 }]),
    OutOfStockError,
  );
  assert.equal(inventory.availableQuantity("book"), 5);
});

// ---------- Local reasoning: calculateTotal ----------

test("calculateTotal depends only on its arguments", () => {
  const input = { lines: [{ productId: "book", unitPrice: 100, quantity: 2 }], taxRate: 0.2, discountPercent: 10 };
  const first = calculateTotal(input);

  runtimeConfig.taxRate = 0.5;
  runtimeConfig.discountPercent = 50;

  assert.equal(calculateTotal(input), first);
  assert.equal(first, 216);
  assert.equal(auditLog.length, 0, "calculation must not write audit log");
});

test("calculateTotal does not mutate input lines", () => {
  const lines: CartLine[] = [
    Object.freeze({ productId: "book", unitPrice: 100, quantity: 2 }),
    Object.freeze({ productId: "pen", unitPrice: 15, quantity: 1 }),
  ];
  const snapshot = structuredClone(lines);

  assert.equal(calculateTotal({ lines: Object.freeze(lines), taxRate: 0, discountPercent: 0 }), 215);
  assert.deepEqual(lines, snapshot);
});

// ---------- Public contracts ----------

test("Checkout public response keeps exactly the same fields", async () => {
  const response = await new CheckoutController().checkout({
    orderId: "order-shape",
    paymentToken: "tok_valid",
    currency: "UAH",
    lines: [{ productId: "book", unitPrice: 100, quantity: 1 }],
  });

  assert.deepEqual(Object.keys(response).sort(), ["orderId", "paymentStatus", "status", "total"]);
  assert.deepEqual(auditLog, ["total_calculated:120"]);
});

test("Payments public result contains no provider-specific fields", async () => {
  const result = await createPaymentGateway().authorize({
    orderId: "o-1",
    amountMinor: 12000,
    currency: "UAH",
    paymentToken: "tok_valid",
  });

  assert.deepEqual(Object.keys(result).sort(), ["paymentId", "status"]);
  assert.equal(result.status, "paid");
});

test("Orders works with any PaymentGateway, not with a concrete provider", async () => {
  const requests: unknown[] = [];
  const fakeGateway: PaymentGateway = {
    async authorize(request) {
      requests.push(request);
      return { status: "processing", paymentId: "fake-1" };
    },
  };

  const order = await new OrderService({ payments: fakeGateway }).placeOrder({
    orderId: "order-fake",
    lines: [{ productId: "book", quantity: 1 }],
    total: 120.5,
    currency: "UAH",
    paymentToken: "tok_x",
  });

  assert.equal(order.status, "payment_pending");
  assert.equal(order.paymentStatus, "processing");
  assert.deepEqual(requests, [
    { orderId: "order-fake", amountMinor: 12050, currency: "UAH", paymentToken: "tok_x" },
  ]);
});