// Public entry point of Payments. Other modules import only from this file.
export type { PaymentGateway, PaymentRequest, PaymentResult, PaymentStatus } from "./contract.ts";

import { runtimeConfig } from "../config.ts";
import type { PaymentGateway } from "./contract.ts";
import { LocalPayClient } from "./internal/localpay/LocalPayClient.ts";
import { LocalPayGateway } from "./internal/localpay/LocalPayGateway.ts";
import { StripeClient } from "./internal/stripe/StripeClient.ts";
import { StripeGateway } from "./internal/stripe/StripeGateway.ts";

export type PaymentProvider = "stripe" | "localpay";

/**
 * Creates the payment gateway for the configured provider.
 * Consumers call createPaymentGateway() and never learn which provider is behind it.
 */
export function createPaymentGateway(
  provider: PaymentProvider = runtimeConfig.paymentProvider,
): PaymentGateway {
  switch (provider) {
    case "stripe":
      return new StripeGateway(new StripeClient());
    case "localpay":
      return new LocalPayGateway(new LocalPayClient());
    default:
      throw new Error(`Unknown payment provider: ${String(provider)}`);
  }
}