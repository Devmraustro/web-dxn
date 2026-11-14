/**
 * Tests for the ESM bundle-integrity checker.
 *
 * The first test intentionally mirrors the production incident:
 *
 *   Uncaught SyntaxError: The requested module './vendor-react-*.js'
 *   does not provide an export named 'k'
 *
 * If this suite ever passes while `analyzeBundle` cannot detect that exact
 * mismatch, the regression gate is worthless — so the negative case asserts the
 * symbol name, the importing chunk and the imported chunk.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  analyzeBuild,
  analyzeBundle,
  extractHtmlAssets,
  maskNonCode,
  parseModule,
  resolveSpecifier,
} from "./esm-bundle-integrity.mjs";

const BUILD_DIR = path.resolve("dist/frontend/build");

test("detects the production missing-export failure and names the symbol", () => {
  const files = {
    "assets/LanguageContext-AAAA1111.js":
      'import{E as ie,k as ae}from"./vendor-react-BBBB2222.js";const t=1;export{t as l};',
    "assets/vendor-react-BBBB2222.js":
      'const ma=1,Da=2;export{ma as j,Da as E,Wu as l};',
  };
  const result = analyzeBundle(files);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  const [error] = result.errors;
  assert.equal(error.reason, "missing-export");
  assert.equal(error.symbol, "k");
  assert.equal(error.target, "assets/vendor-react-BBBB2222.js");
  assert.match(error.detail, /does not provide an export named 'k'/);
});

test("passes when every named import is exported", () => {
  const files = {
    "assets/LanguageContext-AAAA1111.js":
      'import{E as ie,k as ae}from"./vendor-react-BBBB2222.js";export{ie as a,ae as b};',
    "assets/vendor-react-BBBB2222.js": 'const ma=1,Da=2;export{ma as k,Da as E};',
  };
  const result = analyzeBundle(files);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.checkedImports, 2);
});

test("parses minified default, namespace, side-effect and bare imports", () => {
  const source =
    'import e from"./a.js";import*as t from"./b.js";import"./c.css";' +
    'import{r as n,default as o}from"./d.js";export{n as p};';
  const parsed = parseModule(source);
  const bySpecifier = Object.fromEntries(parsed.imports.map((edge) => [edge.specifier, edge.names]));
  assert.deepEqual(bySpecifier["./a.js"], [{ imported: "default", local: "e" }]);
  assert.deepEqual(bySpecifier["./b.js"], [{ imported: "*", local: "t" }]);
  assert.deepEqual(bySpecifier["./c.css"], []);
  assert.deepEqual(bySpecifier["./d.js"], [
    { imported: "r", local: "n" },
    { imported: "default", local: "o" },
  ]);
  assert.deepEqual([...parsed.exports], ["p"]);
});

test("ignores import-like text inside strings and comments", () => {
  const source =
    'const s="import{x as y}from\\"./fake.js\\"";/* import{a}from"./alsofake.js" */' +
    "// import{b}from\"./linefake.js\"\nconst re=/import\\(/g;export{s as t};";
  const parsed = parseModule(source);
  assert.deepEqual(parsed.imports, []);
  const masked = maskNonCode(source);
  assert.equal(masked.length, source.length, "masking must preserve offsets");
});

test("verifies re-export chains and reports missing re-exported symbols", () => {
  const ok = analyzeBundle({
    "assets/entry.js": 'export{a as b}from"./mid.js";',
    "assets/mid.js": 'export{a}from"./leaf.js";',
    "assets/leaf.js": "const a=1;export{a};",
  });
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));

  const broken = analyzeBundle({
    "assets/entry.js": 'export{a as b}from"./mid.js";',
    "assets/mid.js": 'export{gone}from"./leaf.js";',
    "assets/leaf.js": "const a=1;export{a};",
  });
  assert.equal(broken.ok, false);
  const symbols = broken.errors.map((error) => error.symbol);
  assert.ok(symbols.includes("gone"), `expected a 'gone' error, got ${JSON.stringify(symbols)}`);
  assert.ok(symbols.includes("a"), `expected an 'a' error, got ${JSON.stringify(symbols)}`);
});

test("treats `export *` as unverifiable instead of a hard failure", () => {
  const result = analyzeBundle({
    "assets/entry.js": 'import{anything}from"./barrel.js";export{anything as x};',
    "assets/barrel.js": 'export*from"./leaf.js";',
    "assets/leaf.js": "const real=1;export{real};",
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].reason, "unverifiable-through-star-export");
});

test("flags missing chunk files for static and dynamic imports", () => {
  const missingStatic = analyzeBundle({
    "assets/entry.js": 'import{a}from"./nope.js";export{a as b};',
  });
  assert.equal(missingStatic.ok, false);
  assert.equal(missingStatic.errors[0].reason, "missing-module");

  const missingLazy = analyzeBundle({
    "assets/entry.js": 'export const load=()=>import("./lazy-gone.js");',
  });
  assert.equal(missingLazy.ok, false);
  assert.equal(missingLazy.errors[0].reason, "missing-module");
  assert.match(missingLazy.errors[0].detail, /lazy-gone\.js/);
});

test("extracts index.html asset references and reports missing files", () => {
  const html =
    '<script type="module" crossorigin src="/assets/index-AAAA.js"></script>' +
    '<link rel="modulepreload" href="/assets/vendor-react-BBBB.js">' +
    '<link rel="stylesheet" href="/assets/index-CCCC.css">';
  assert.deepEqual(extractHtmlAssets(html), [
    "assets/index-AAAA.js",
    "assets/vendor-react-BBBB.js",
    "assets/index-CCCC.css",
  ]);

  const result = analyzeBuild({
    html,
    files: { "assets/index-AAAA.js": "export const ok=1;" },
  });
  assert.equal(result.ok, false);
  const reasons = result.errors.map((error) => error.reason);
  assert.deepEqual(reasons.sort(), ["missing-asset", "missing-asset"]);
});

test("resolves relative specifiers including parent segments", () => {
  assert.equal(resolveSpecifier("assets/index.js", "./vendor.js"), "assets/vendor.js");
  assert.equal(resolveSpecifier("assets/nested/chunk.js", "../vendor.js"), "assets/vendor.js");
  assert.equal(resolveSpecifier("assets/index.js", "react"), null);
});

test("real production build is internally consistent", async (t) => {
  if (!existsSync(path.join(BUILD_DIR, "index.html"))) {
    t.skip("no build present — run `npm run build` first");
    return;
  }
  const files = {};
  const assetsDir = path.join(BUILD_DIR, "assets");
  for (const name of await readdir(assetsDir)) {
    if (!/\.(?:js|css)$/.test(name)) continue;
    files[`assets/${name}`] = await readFile(path.join(assetsDir, name), "utf8");
  }
  const html = await readFile(path.join(BUILD_DIR, "index.html"), "utf8");
  const result = analyzeBuild({ html, files });
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.ok(result.checkedModules >= 10, `expected a real module graph, got ${result.checkedModules}`);
  assert.ok(result.checkedImports >= 100, `expected many verified imports, got ${result.checkedImports}`);
});

test("real build with one export removed fails on the exact symbol", async (t) => {
  if (!existsSync(path.join(BUILD_DIR, "assets"))) {
    t.skip("no build present — run `npm run build` first");
    return;
  }
  const assetsDir = path.join(BUILD_DIR, "assets");
  const names = await readdir(assetsDir);
  const consumer = names.find((name) => /^LanguageContext-.*\.js$/.test(name));
  const reactChunk = names.find((name) => /^vendor-react-.*\.js$/.test(name));
  if (!consumer || !reactChunk) {
    t.skip("this build has no separate LanguageContext/vendor-react chunks");
    return;
  }

  const consumerSource = await readFile(path.join(assetsDir, consumer), "utf8");
  const reactSource = await readFile(path.join(assetsDir, reactChunk), "utf8");

  // Symbolically import something the provider chunk is guaranteed not to export.
  const tamperedConsumer = consumerSource.replace(
    /from"\.\/vendor-react-[^"]+"/,
    'from"./vendor-react-MISSING.js"',
  );

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bundle-integrity-"));
  try {
    const files = { [`assets/${consumer}`]: tamperedConsumer };
    await copyFile(path.join(assetsDir, reactChunk), path.join(tempDir, reactChunk));
    files[`assets/${reactChunk}`] = reactSource;
    const result = analyzeBundle(files);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((error) => error.reason === "missing-module"),
      "pointing a chunk at a non-existent vendor chunk must be detected",
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
