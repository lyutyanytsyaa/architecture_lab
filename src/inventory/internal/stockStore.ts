import { database, type StockRow } from "../../database.ts";

// Low-level access to stock storage. Only the Inventory module may use it.

export function findStock(productId: string): StockRow | undefined {
  return database.stock.get(productId);
}

export function decrementStock(productId: string, quantity: number): void {
  const row = database.stock.get(productId);
  if (!row || row.available < quantity) {
    throw new Error(`Invariant violation: stock for ${productId} would become negative`);
  }
  database.stock.set(productId, { productId, available: row.available - quantity });
}