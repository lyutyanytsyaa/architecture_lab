// Public entry point of Payments. Other modules import only from this file.
export type { PaymentGateway, PaymentRequest, PaymentResult, PaymentStatus } from "./contract.ts";

import type { PaymentGateway } from "./contract.ts";
import { StripeClient } from "./internal/stripe/StripeClient.ts";
import { StripeGateway } from "./internal/stripe/StripeGateway.ts";

/** Creates the payment gateway used by the application. */
export function createPaymentGateway(): PaymentGateway {
  return new StripeGateway(new StripeClient());
}