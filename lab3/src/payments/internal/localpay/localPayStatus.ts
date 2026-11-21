import type { PaymentStatus } from "../../contract.ts";

/** The only place that translates LocalPay results into PaymentStatus. */
export function normalizeLocalPayStatus(result: string): PaymentStatus {
  switch (result) {
    case "OK":
      return "paid";
    case "WAIT":
      return "processing";
    case "REJECT":
      return "failed";
    default:
      // Same safe rule as for Stripe: unknown result means unknown outcome.
      return "processing";
  }
}