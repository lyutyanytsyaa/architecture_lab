// Local stand-in for the Stripe SDK. Deterministic so it can be tested:
// token "fail_*" -> declined, "proc_*" -> processing, anything else -> succeeded.

export type StripePayload = {
  id: string;
  amount: number;
  currency: string;
  metadata: { orderId: string };
};

export type StripeResponse = {
  charge_id: string;
  state: "succeeded" | "processing" | "requires_action" | "declined";
};

export class StripeClient {
  async createCharge(payload: StripePayload): Promise<StripeResponse> {
    const state: StripeResponse["state"] = payload.id.startsWith("fail_")
      ? "declined"
      : payload.id.startsWith("proc_")
        ? "processing"
        : "succeeded";
    return { charge_id: `ch_${payload.id}`, state };
  }
}