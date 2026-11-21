/**
 * Public, provider-neutral contract of the Payments module.
 * Nothing here mentions a concrete provider: no payload shapes, no provider status names.
 */

/** Stable payment status of the system. */
export type PaymentStatus = "paid" | "processing" | "failed";

export type PaymentRequest = {
  orderId: string;
  /** Amount in minor units (kopiyky, cents) to avoid floating point rounding. */
  amountMinor: number;
  currency: string;
  /** Opaque token of the customer's payment method. */
  paymentToken: string;
};

export type PaymentResult = {
  status: PaymentStatus;
  /** Our reference to the payment; its format is a Payments implementation detail. */
  paymentId: string;
};

export interface PaymentGateway {
  authorize(request: PaymentRequest): Promise<PaymentResult>;
}