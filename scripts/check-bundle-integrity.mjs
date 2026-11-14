#!/usr/bin/env node
/**
 * Bundle integrity gate.
 *
 * Validates that a frontend build — or the bytes actually served by a live
 * deployment — form one internally consistent ES module graph: every HTML asset
 * reference exists, every relative import resolves, and every named import is
 * really exported by the chunk it is imported from.
 *
 * Usage:
 *   node scripts/check-bundle-integrity.mjs                     # local dist/frontend/build
 *   node scripts/check-bundle-integrity.mjs --dir <buildDir>
 *   node scripts/check-bundle-integrity.mjs --url https://example.com
 *   node scripts/check-bundle-integrity.mjs --url https://example.com --compare-dir dist/frontend/build
 *
 * Exit status: 0 = consistent, 1 = integrity failure (or unreachable target),
 * 2 = usage error. With --diagnostic the report is still produced but the exit
 * status stays 0, which is used while probing a deployment that is known to be
 * broken and has not been replaced yet.
 */

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  analyzeBuild,
  MODULE_EXTENSIONS,
  resolveSpecifier,
  isRelativeSpecifier,
  parseModule,
} from "./lib/esm-bundle-integrity.mjs";

const MAX_REMOTE_ASSETS = 400;

function parseArgs(argv) {
  const options = {
    dir: "dist/frontend/build",
    url: "",
    compareDir: "",
    json: "",
    diagnostic: false,
    fresh: false,
    verbose: false,
    timeoutMs: 20000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };
    switch (arg) {
      case "--dir": options.dir = take(); break;
      case "--url": options.url = take(); break;
      case "--compare-dir": options.compareDir = take(); break;
      case "--json": options.json = take(); break;
      case "--timeout": options.timeoutMs = Number(take()); break;
      case "--diagnostic": options.diagnostic = true; break;
      case "--fresh": options.fresh = true; break;
      case "--verbose": options.verbose = true; break;
      case "--help":
      case "-h":
        options.help = true; break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function walk(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = {};
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(files, await walk(path.join(dir, entry.name), rel));
    } else if (/\.(?:js|mjs|cjs|css|json)$/.test(entry.name)) {
      files[rel] = await readFile(path.join(dir, entry.name), "utf8");
    }
  }
  return files;
}

async function loadLocalBuild(dir, rootFiles) {
  const abs = path.resolve(dir);
  const files = await walk(abs);
  // index.html lives in the build root, one level above assets/
  let html = "";
  try {
    html = await readFile(path.join(abs, "index.html"), "utf8");
  } catch {
    html = "";
  }
  if (rootFiles) Object.assign(files, rootFiles);
  return { html, files, abs };
}

async function fetchText(url, options, { expectBinary = false } = {}) {
  const headers = {
    "cache-control": "no-cache",
    pragma: "no-cache",
    "user-agent": "dxn-bundle-integrity/1.0",
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      text: expectBinary ? "" : buffer.toString("utf8"),
      bytes: buffer.length,
      sha256: sha256(buffer),
      url: response.url,
    };
  } finally {
    clearTimeout(timer);
  }
}

function withCacheBuster(url, fresh) {
  if (!fresh) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}__integrity=${Date.now()}`;
}

/** Fetch the deployment's HTML and every asset reachable from it. */
async function loadRemoteBuild(baseUrl, options) {
  const base = baseUrl.replace(/\/+$/, "");
  const documentUrl = `${base}/`;
  const document = await fetchText(withCacheBuster(documentUrl, options.fresh), options);
  if (document.status !== 200) {
    throw new Error(`GET ${documentUrl} returned HTTP ${document.status}`);
  }

  const files = {};
  const assets = [];
  const queue = [];
  const seen = new Set();

  const htmlAssetsRe = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = htmlAssetsRe.exec(document.text)) !== null) {
    const value = match[1];
    if (/\.(?:js|mjs|cjs|css|json)$/.test(value)) queue.push(value.replace(/^\//, ""));
  }

  while (queue.length > 0 && assets.length < MAX_REMOTE_ASSETS) {
    const assetPath = queue.shift();
    if (seen.has(assetPath)) continue;
    seen.add(assetPath);

    const assetUrl = withCacheBuster(`${base}/${assetPath}`, options.fresh);
    const asset = await fetchText(assetUrl, options);
    const record = {
      path: assetPath,
      status: asset.status,
      bytes: asset.bytes,
      sha256: asset.sha256,
      contentType: asset.headers["content-type"] ?? "",
      cacheControl: asset.headers["cache-control"] ?? "",
      vercelCache: asset.headers["x-vercel-cache"] ?? "",
      age: asset.headers["age"] ?? "",
      etag: asset.headers["etag"] ?? "",
    };
    assets.push(record);
    files[assetPath] = asset.text;

    if (!MODULE_EXTENSIONS.some((ext) => assetPath.endsWith(ext))) continue;
    let parsed;
    try {
      parsed = parseModule(asset.text);
    } catch {
      continue;
    }
    const specifiers = [
      ...parsed.imports.map((edge) => edge.specifier),
      ...parsed.reExports.map((edge) => edge.specifier),
      ...parsed.starReExports,
      ...parsed.dynamicImports,
    ];
    for (const specifier of specifiers) {
      if (!isRelativeSpecifier(specifier)) continue;
      const resolved = resolveSpecifier(assetPath, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }

  return { html: document.text, files, assets, document };
}

function describeAsset(asset) {
  return [
    `${asset.status}`,
    `${String(asset.bytes).padStart(8)} B`,
    asset.sha256.slice(0, 16),
    asset.vercelCache ? `edge=${asset.vercelCache}` : "",
    asset.age ? `age=${asset.age}` : "",
    asset.path,
  ]
    .filter(Boolean)
    .join("  ");
}

async function compareWithLocal(remoteAssets, compareDir) {
  const abs = path.resolve(compareDir);
  const differences = [];
  const localIndex = new Map();
  const walkLocal = async (dir, prefix = "") => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walkLocal(path.join(dir, entry.name), rel);
      else localIndex.set(rel, path.join(dir, entry.name));
    }
  };
  await walkLocal(abs);

  for (const asset of remoteAssets) {
    const relative = asset.path.replace(/^assets\//, "");
    const localPath = localIndex.get(`assets/${relative}`) ?? localIndex.get(relative);
    if (!localPath) {
      differences.push({ path: asset.path, reason: "not-in-local-build" });
      continue;
    }
    const localBytes = await readFile(localPath);
    const localSha = sha256(localBytes);
    if (localSha !== asset.sha256) {
      differences.push({
        path: asset.path,
        reason: "content-differs",
        served: asset.sha256,
        local: localSha,
        servedBytes: asset.bytes,
        localBytes: localBytes.length,
      });
    }
  }
  return differences;
}

function report(result, { options, target, remote }) {
  const lines = [];
  lines.push(`Bundle integrity check — ${target}`);
  if (remote?.document) {
    lines.push(
      `Document: HTTP ${remote.document.status} · ${remote.document.bytes} B · sha256 ${remote.document.sha256.slice(0, 16)}` +
        (remote.document.headers["cache-control"] ? ` · cache-control: ${remote.document.headers["cache-control"]}` : ""),
    );
  }
  if (remote?.assets?.length) {
    lines.push("");
    lines.push("Served assets:");
    for (const asset of remote.assets) lines.push(`  ${describeAsset(asset)}`);
  }
  lines.push("");
  lines.push(`Modules checked: ${result.checkedModules} · named imports verified: ${result.checkedImports}`);
  if (result.warnings?.length) {
    lines.push(`Warnings: ${result.warnings.length}`);
    for (const warning of result.warnings.slice(0, 10)) {
      lines.push(`  warn ${warning.reason}: ${warning.file} -> ${warning.specifier} (${warning.name})`);
    }
  }
  if (result.errors.length === 0) {
    lines.push("RESULT: PASS — every import in the bundle resolves to a real export.");
  } else {
    lines.push(`RESULT: FAIL — ${result.errors.length} module-linking error(s):`);
    for (const error of result.errors) {
      lines.push(`  ${error.reason}: ${error.detail}`);
      if (options.verbose) lines.push(`    ${JSON.stringify(error)}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("See the header of scripts/check-bundle-integrity.mjs for usage.");
    return 0;
  }

  let html;
  let files;
  let remote = null;
  let target;

  if (options.url) {
    target = options.url;
    remote = await loadRemoteBuild(options.url, options);
    html = remote.html;
    files = remote.files;
  } else {
    const local = await loadLocalBuild(options.dir);
    target = local.abs;
    html = local.html;
    files = local.files;
    if (!html) {
      console.error(`No index.html found in ${local.abs} — run the production build first.`);
      return 1;
    }
  }

  const result = analyzeBuild({ html, files });
  let differences = [];
  if (options.compareDir && remote) {
    differences = await compareWithLocal(remote.assets, options.compareDir);
  }

  console.log(report(result, { options, target, remote }));

  if (differences.length > 0) {
    console.log("");
    console.log(`Comparison with ${options.compareDir}: ${differences.length} difference(s)`);
    for (const difference of differences) {
      console.log(
        `  ${difference.reason}: ${difference.path}` +
          (difference.served ? ` (served ${difference.served.slice(0, 16)} / local ${difference.local.slice(0, 16)})` : ""),
      );
    }
  } else if (options.compareDir && remote) {
    console.log("");
    console.log(`Comparison with ${options.compareDir}: served assets are byte-identical to the local build.`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    target,
    url: options.url || null,
    ok: result.ok && differences.length === 0,
    integrity: {
      ok: result.ok,
      checkedModules: result.checkedModules,
      checkedImports: result.checkedImports,
      errors: result.errors,
      warnings: result.warnings,
      referencedAssets: result.referencedAssets,
    },
    servedAssets: remote?.assets ?? [],
    document: remote?.document
      ? {
          status: remote.document.status,
          bytes: remote.document.bytes,
          sha256: remote.document.sha256,
          cacheControl: remote.document.headers["cache-control"] ?? "",
        }
      : null,
    comparison: differences,
  };

  if (options.json) {
    await mkdir(path.dirname(path.resolve(options.json)), { recursive: true });
    await writeFile(path.resolve(options.json), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`Report written to ${options.json}`);
  }

  const failed = !result.ok || differences.length > 0;
  if (failed && !options.diagnostic) return 1;
  if (failed && options.diagnostic) {
    console.log("(diagnostic mode: integrity failure recorded, exit status forced to 0)");
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`bundle-integrity: ${error.message}`);
    process.exit(1);
  });
