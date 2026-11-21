export const runtimeConfig: {
  taxRate: number;
  discountPercent: number;
  paymentProvider: "stripe" | "localpay";
} = {
  taxRate: 0.2,
  discountPercent: 0,
  paymentProvider: "stripe",
};

export const auditLog: string[] = [];