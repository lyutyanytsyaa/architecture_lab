import type { PaymentGateway, PaymentRequest, PaymentResult } from "../../contract.ts";
import type { LocalPayClient, LocalPayRequest } from "./LocalPayClient.ts";
import { normalizeLocalPayStatus } from "./localPayStatus.ts";

/** Adapter: translates the neutral Payments contract to LocalPay and back. */
export class LocalPayGateway implements PaymentGateway {
  private readonly client: LocalPayClient;

  constructor(client: LocalPayClient) {
    this.client = client;
  }

  async authorize(request: PaymentRequest): Promise<PaymentResult> {
    const payload: LocalPayRequest = {
      merchant_order: request.orderId,
      sum: (request.amountMinor / 100).toFixed(2),
      ccy: request.currency,
      card_ref: request.paymentToken,
    };
    const response = await this.client.pay(payload);
    return {
      status: normalizeLocalPayStatus(response.result),
      paymentId: response.txn_id,
    };
  }
}