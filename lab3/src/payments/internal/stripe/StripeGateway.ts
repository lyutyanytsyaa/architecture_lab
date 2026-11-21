import type { PaymentGateway, PaymentRequest, PaymentResult } from "../../contract.ts";
import type { StripeClient, StripePayload } from "./StripeClient.ts";
import { normalizeStripeStatus } from "./stripeStatus.ts";

/** Adapter: translates the neutral Payments contract to Stripe and back. */
export class StripeGateway implements PaymentGateway {
  private readonly client: StripeClient;

  constructor(client: StripeClient) {
    this.client = client;
  }

  async authorize(request: PaymentRequest): Promise<PaymentResult> {
    const payload: StripePayload = {
      id: request.paymentToken,
      amount: request.amountMinor,
      currency: request.currency,
      metadata: { orderId: request.orderId },
    };
    const response = await this.client.createCharge(payload);
    return {
      status: normalizeStripeStatus(response.state),
      paymentId: response.charge_id,
    };
  }
}