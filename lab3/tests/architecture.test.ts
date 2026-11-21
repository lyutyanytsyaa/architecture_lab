import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const checker = join(import.meta.dirname, "..", "scripts", "check-architecture.ts");
const sourceRoot = join(import.meta.dirname, "..", "src");

function runChecker(root: string) {
  return spawnSync(process.execPath, [checker, root], { encoding: "utf8" });
}

function withBrokenCopy(file: string, extraCode: string) {
  const dir = mkdtempSync(join(tmpdir(), "arch-"));
  try {
    cpSync(sourceRoot, dir, { recursive: true });
    appendFileSync(join(dir, file), `\n${extraCode}\n`);
    return runChecker(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("current repository passes the architecture checks", () => {
  const result = runChecker(sourceRoot);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS no dependency cycles/);
});

test("import of another module's internal file is rejected", () => {
  const result = withBrokenCopy(
    "checkout/CheckoutController.ts",
    'import { StripeClient } from "../payments/internal/stripe/StripeClient.ts";',
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[internal-import\] checkout\/CheckoutController\.ts:\d+/);
});

test("direct write to Inventory storage from Orders is rejected", () => {
  const result = withBrokenCopy(
    "orders/OrderService.ts",
    'import { database } from "../database.ts";\ndatabase.stock.set("book", { productId: "book", available: -1 });',
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[stock-ownership\] orders\/OrderService\.ts:\d+/);
});

test("destructured access to stock from Checkout is rejected", () => {
  const result = withBrokenCopy(
    "checkout/CheckoutController.ts",
    'import { database as db2 } from "../database.ts";\nconst { stock } = database;',
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[stock-ownership\] checkout\/CheckoutController\.ts/);
});

test("a new dependency cycle between Payments and Orders is rejected", () => {
  const result = withBrokenCopy("payments/index.ts", 'import "../orders/OrderService.ts";');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[cycle\] module dependency cycle: .*orders.*payments|payments.*orders/);
  assert.match(result.stderr, /\[cycle\] file dependency cycle/);
});