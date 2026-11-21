import { decrementStock, findStock } from "./internal/stockStore.ts";

export type StockLine = { productId: string; quantity: number };

export class OutOfStockError extends Error {
  readonly productId: string;

  constructor(productId: string) {
    super(`Insufficient stock for ${productId}`);
    this.name = "OutOfStockError";
    this.productId = productId;
  }
}

/**
 * Inventory owns stock and protects the invariant available >= 0.
 * reserve() is all-or-nothing: it either reserves every line or changes nothing.
 */
export class Inventory {
  reserve(lines: readonly StockLine[]): void {
    const needed = new Map<string, number>();
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new Error(`Invalid quantity for ${line.productId}`);
      }
      needed.set(line.productId, (needed.get(line.productId) ?? 0) + line.quantity);
    }

    // Phase 1: check everything before touching storage.
    for (const [productId, quantity] of needed) {
      const row = findStock(productId);
      if (!row || row.available < quantity) {
        throw new OutOfStockError(productId);
      }
    }

    // Phase 2: write. No await between the phases, so nothing can interleave.
    for (const [productId, quantity] of needed) {
      decrementStock(productId, quantity);
    }
  }

  availableQuantity(productId: string): number {
    return findStock(productId)?.available ?? 0;
  }
}