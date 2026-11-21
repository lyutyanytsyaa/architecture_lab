import type { PaymentStatus } from "../payments/paymentStatus.ts";

/** Notifications work only with the normalized status and know nothing about providers. */
export function paymentMessageFor(status: PaymentStatus): string {
  if (status === "paid") return "Оплату отримано, замовлення підтверджено.";
  if (status === "processing") return "Оплата обробляється. Ми повідомимо про результат.";
  return "Оплата не пройшла. Спробуйте інший спосіб оплати.";
}