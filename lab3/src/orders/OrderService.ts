import { Inventory } from "../inventory/index.ts";
import { createPaymentGateway, type PaymentGateway } from "../payments/index.ts";
import { createOrder, recordPayment } from "./internal/orderRecords.ts";

export type OrderLine = { productId: string; quantity: number };

export type PlaceOrderRequest = {
  orderId: string;
  lines: readonly OrderLine[];
  total: number;
  currency: string;
  paymentToken: string;
};

export type OrderServiceDeps = {
  inventory?: Inventory;
  payments?: PaymentGateway;
};

/**
 * Orders coordinates the order lifecycle. Stock belongs to Inventory and
 * payment details belong to Payments; both are used only via public APIs.
 */
export class OrderService {
  private readonly inventory: Inventory;
  private readonly payments: PaymentGateway;

  constructor(deps: OrderServiceDeps = {}) {
    this.inventory = deps.inventory ?? new Inventory();
    this.payments = deps.payments ?? createPaymentGateway();
  }

  async placeOrder(request: PlaceOrderRequest) {
    this.inventory.reserve(request.lines);
    createOrder(request.orderId, request.total);

    const payment = await this.payments.authorize({
      orderId: request.orderId,
      amountMinor: Math.round(request.total * 100),
      currency: request.currency,
      paymentToken: request.paymentToken,
    });

    return recordPayment(request.orderId, payment.status);
  }
}