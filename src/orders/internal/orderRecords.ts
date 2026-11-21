import { database, type OrderRow } from "../../database.ts";
import type { PaymentStatus } from "../../payments/index.ts";

// Orders owns the orders storage; only OrderService uses these functions.

export function createOrder(orderId: string, total: number): void {
  database.orders.set(orderId, { id: orderId, status: "created", total });
}

export function recordPayment(orderId: string, paymentStatus: PaymentStatus): OrderRow {
  const order = database.orders.get(orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  order.paymentStatus = paymentStatus;
  order.status = paymentStatus === "paid" ? "confirmed" : "payment_pending";
  return { ...order };
}