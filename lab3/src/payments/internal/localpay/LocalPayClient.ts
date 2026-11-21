// Second, purely educational payment provider ("LocalPay").
// It deliberately uses its own request, response and status names, unlike Stripe.
// Deterministic: card_ref "fail_*" -> REJECT, "proc_*" -> WAIT, anything else -> OK.

export type LocalPayRequest = {
  merchant_order: string;
  /** LocalPay expects the amount in major units as a string, e.g. "120.50". */
  sum: string;
  ccy: string;
  card_ref: string;
};

export type LocalPayResponse = {
  txn_id: string;
  result: "OK" | "WAIT" | "REJECT";
};

export class LocalPayClient {
  async pay(request: LocalPayRequest): Promise<LocalPayResponse> {
    const result: LocalPayResponse["result"] = request.card_ref.startsWith("fail_")
      ? "REJECT"
      : request.card_ref.startsWith("proc_")
        ? "WAIT"
        : "OK";
    return { txn_id: `lp-${request.merchant_order}`, result };
  }
}