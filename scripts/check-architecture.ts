// Architecture fitness functions.
//
// Usage: node scripts/check-architecture.ts [rootDir]   (rootDir defaults to "src")
//
// Rules:
//   1. internal-import  — a module must not import an `internal` file of another module;
//   2. stock-ownership  — only Inventory may touch Inventory storage (database.stock);
//   3. cycle            — no dependency cycle between local files or between modules.
//
// The script scans the current repository tree on every run (no hardcoded file names),
// prints every violation with file:line and exits with code 1 if anything is wrong.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const STOCK_OWNER_MODULE = "inventory";

type ImportEdge = { from: string; to: string; line: number; specifier: string };
type Violation = { rule: string; message: string };

const rootDir = resolve(process.argv[2] ?? "src");

if (!existsSync(rootDir)) {
  console.error(`check:architecture: directory not found: ${rootDir}`);
  process.exit(2);
}

// ---------- reading the tree ----------

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listSourceFiles(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith(".d.ts")) files.push(full);
  }
  return files;
}

/** Path relative to the root, always with "/" separators. */
function rel(file: string): string {
  return relative(rootDir, file).split(sep).join("/");
}

/** Module = first folder under the root; a file directly in the root is its own module. */
function moduleOf(file: string): string {
  const parts = rel(file).split("/");
  return parts.length > 1 ? parts[0] : parts[0].replace(/\.[^.]+$/, "");
}

/** Removes comments but keeps line breaks, so line numbers stay correct. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function lineAt(code: string, index: number): number {
  return code.slice(0, index).split("\n").length;
}

function resolveImport(fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined; // packages and node: built-ins
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.js`, join(base, "index.ts"), join(base, "index.js")];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

const IMPORT_PATTERNS = [
  /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm, // import x from "y"; export { x } from "y"
  /^\s*import\s*["']([^"']+)["']/gm, // import "y";
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, // await import("y")
];

const files = listSourceFiles(rootDir);
const sources = new Map(files.map((file) => [file, stripComments(readFileSync(file, "utf8"))]));
const edges: ImportEdge[] = [];

for (const [file, code] of sources) {
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of code.matchAll(pattern)) {
      const target = resolveImport(file, match[1]);
      if (target && sources.has(target)) {
        const start = (match.index ?? 0) + match[0].search(/\S/);
        edges.push({ from: file, to: target, line: lineAt(code, start), specifier: match[1] });
      }
    }
  }
}

const violations: Violation[] = [];

// ---------- rule 1: no imports of another module's internal files ----------

for (const edge of edges) {
  const fromModule = moduleOf(edge.from);
  const toModule = moduleOf(edge.to);
  const insideTarget = rel(edge.to).split("/").slice(1);
  if (fromModule !== toModule && insideTarget.includes("internal")) {
    violations.push({
      rule: "internal-import",
      message:
        `${rel(edge.from)}:${edge.line} imports "${edge.specifier}" — an internal file of module "${toModule}". ` +
        `Use the public API of "${toModule}" instead.`,
    });
  }
}

// ---------- rule 2: only Inventory touches stock storage ----------

const STOCK_ACCESS = [
  /\bdatabase\s*(?:\?\.|\.)\s*stock\b/g, // database.stock / database?.stock
  /\bdatabase\s*\[\s*["'`]stock["'`]\s*\]/g, // database["stock"]
  /\{[^{}]*\bstock\b[^{}]*\}\s*=\s*database\b/g, // const { stock } = database
];

for (const [file, code] of sources) {
  const module = moduleOf(file);
  const isRootFile = !rel(file).includes("/"); // database.ts defines storage, demo.ts seeds it
  if (module === STOCK_OWNER_MODULE || isRootFile) continue;
  for (const pattern of STOCK_ACCESS) {
    for (const match of code.matchAll(pattern)) {
      violations.push({
        rule: "stock-ownership",
        message:
          `${rel(file)}:${lineAt(code, match.index ?? 0)} accesses Inventory storage directly ("${match[0].trim()}"). ` +
          `Only module "${STOCK_OWNER_MODULE}" may read or change stock; use Inventory.reserve().`,
      });
    }
  }
}

// ---------- rule 3: no dependency cycles ----------

function findCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function visit(node: string): void {
    state.set(node, "visiting");
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === "visiting") {
        const cycle = stack.slice(stack.indexOf(next));
        const key = [...cycle].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push([...cycle, next]);
        }
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, "done");
  }

  for (const node of [...graph.keys()].sort()) {
    if (!state.has(node)) visit(node);
  }
  return cycles;
}

const fileGraph = new Map<string, Set<string>>();
const moduleGraph = new Map<string, Set<string>>();
for (const file of files) fileGraph.set(rel(file), new Set());
for (const edge of edges) {
  fileGraph.get(rel(edge.from))!.add(rel(edge.to));
  const fromModule = moduleOf(edge.from);
  const toModule = moduleOf(edge.to);
  if (fromModule !== toModule) {
    if (!moduleGraph.has(fromModule)) moduleGraph.set(fromModule, new Set());
    moduleGraph.get(fromModule)!.add(toModule);
  }
}

for (const cycle of findCycles(fileGraph)) {
  violations.push({ rule: "cycle", message: `file dependency cycle: ${cycle.join(" -> ")}` });
}
for (const cycle of findCycles(moduleGraph)) {
  const examples = cycle.slice(0, -1).map((module, i) => {
    const next = cycle[i + 1];
    const edge = edges.find((e) => moduleOf(e.from) === module && moduleOf(e.to) === next)!;
    return `${rel(edge.from)}:${edge.line} -> ${rel(edge.to)}`;
  });
  violations.push({
    rule: "cycle",
    message: `module dependency cycle: ${cycle.join(" -> ")} (${examples.join("; ")})`,
  });
}

// ---------- report ----------

const label = relative(process.cwd(), rootDir) || ".";
console.log(`check:architecture — ${files.length} files, ${edges.length} local imports in ${label}`);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`FAIL [${violation.rule}] ${violation.message}`);
  }
  console.error(`\n${violations.length} architecture violation(s) found.`);
  process.exit(1);
}

console.log("PASS no imports of another module's internal files");
console.log("PASS no access to Inventory storage outside Inventory");
console.log("PASS no dependency cycles between files or modules");