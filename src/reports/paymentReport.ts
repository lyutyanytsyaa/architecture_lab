import type { PaymentStatus } from "../payments/paymentStatus.ts";

export type ReportBucket = "revenue" | "awaiting_payment" | "lost";

/** Reports work only with the normalized status and know nothing about providers. */
export function reportBucketFor(status: PaymentStatus): ReportBucket {
  if (status === "paid") return "revenue";
  if (status === "processing") return "awaiting_payment";
  return "lost";
}