import type { PaymentStatus } from "../../contract.ts";

/**
 * The only place that translates Stripe states into PaymentStatus.
 *
 * Unknown states are treated as "processing", not "failed": the provider may
 * already have charged the card, so we must not tell the customer the payment
 * failed (they would pay again) and must not confirm the order either.
 */
export function normalizeStripeStatus(state: string): PaymentStatus {
  switch (state) {
    case "succeeded":
      return "paid";
    case "processing":
    case "requires_action":
      return "processing";
    case "declined":
    case "canceled":
      return "failed";
    default:
      return "processing";
  }
}