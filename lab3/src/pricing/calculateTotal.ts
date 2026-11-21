export type CartLine = {
  productId: string;
  unitPrice: number;
  quantity: number;
};

export type PricingInput = {
  lines: readonly CartLine[];
  /** For example 0.2 for 20% VAT. */
  taxRate: number;
  /** For example 10 for a 10% discount. */
  discountPercent: number;
};

/**
 * Pure function: the result depends only on the arguments.
 * It does not read config, does not mutate lines and does not log.
 */
export function calculateTotal({ lines, taxRate, discountPercent }: PricingInput): number {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discounted = subtotal * (1 - discountPercent / 100);
  return Number((discounted * (1 + taxRate)).toFixed(2));
}