/**
 * ESM bundle integrity checking.
 *
 * Why this exists
 * ---------------
 * Production failed with a fatal module-linking error before React mounted:
 *
 *   Uncaught SyntaxError: The requested module './vendor-react-*.js'
 *   does not provide an export named 'k'
 *
 * That class of failure is invisible to ordinary smoke tests: every asset can
 * return HTTP 200 with a valid JavaScript content type, every chunk can parse,
 * and the page still never renders, because the module *graph* is internally
 * inconsistent. Import/export linkage is resolved by the browser before any
 * application code runs, so a mismatch can only be caught by validating the
 * emitted bytes against each other.
 *
 * This module parses the emitted (minified, single-line) chunks, resolves every
 * relative specifier, and verifies that every named import / re-export exists in
 * the target module's export table. It works on a local build directory and on
 * bytes fetched from a live deployment, which makes it possible to prove whether
 * the assets a browser receives actually belong to one consistent build.
 *
 * No third-party dependencies: the checker runs inside CI before tests and must
 * never fail because of its own dependency tree.
 */

/** File extensions we treat as part of the module graph. */
export const MODULE_EXTENSIONS = [".js", ".mjs", ".cjs"];

/** Message text that browsers use for a link-time mismatch (used by callers). */
export const LINK_ERROR_PATTERN =
  /does not provide an export named|Importing a module script failed|Failed to fetch dynamically imported module|Expected a JavaScript (?:module )?script|Cannot use import statement outside a module|Unexpected token 'export'/i;

/**
 * Replace the contents of strings, comments and regex literals with spaces so
 * later regular expressions only ever match real code tokens. Lengths and
 * offsets are preserved, so match indices map 1:1 onto the original source.
 */
export function maskNonCode(source) {
  const out = source.split("");
  const n = source.length;
  let i = 0;
  let lastSignificant = "";

  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k += 1) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "/" && next === "/") {
      const start = i;
      while (i < n && source[i] !== "\n") i += 1;
      blank(start, i);
      continue;
    }

    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i = Math.min(n, i + 2);
      blank(start, i);
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      const start = i;
      i += 1;
      while (i < n) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i += 1;
          break;
        }
        // A template literal may contain ${ ... } expressions; nested strings and
        // braces are skipped so the literal end is found correctly.
        if (quote === "`" && source[i] === "$" && source[i + 1] === "{") {
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (source[i] === "{") depth += 1;
            else if (source[i] === "}") depth -= 1;
            else if (source[i] === '"' || source[i] === "'" || source[i] === "`") {
              const inner = source[i];
              i += 1;
              while (i < n) {
                if (source[i] === "\\") {
                  i += 2;
                  continue;
                }
                if (source[i] === inner) {
                  i += 1;
                  break;
                }
                i += 1;
              }
              continue;
            }
            i += 1;
          }
          continue;
        }
        i += 1;
      }
      // Keep the delimiters, blank the body: the delimiters are not code either,
      // but keeping them avoids gluing neighbouring tokens together.
      blank(start + 1, i - 1);
      lastSignificant = quote;
      continue;
    }

    if (ch === "/" && canStartRegex(lastSignificant)) {
      const start = i;
      i += 1;
      let inClass = false;
      while (i < n) {
        const c = source[i];
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
          i += 1;
          break;
        } else if (c === "\n") break;
        i += 1;
      }
      while (i < n && /[a-z]/i.test(source[i])) i += 1; // flags
      blank(start + 1, i - 1);
      lastSignificant = "/";
      continue;
    }

    if (!/\s/.test(ch)) lastSignificant = ch;
    i += 1;
  }

  return out.join("");
}

function canStartRegex(previous) {
  if (!previous) return true;
  return "([{,;:=!&|?+-*%~^<>".includes(previous);
}

function splitTopLevelList(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Parse an import/export clause such as `a as b, c` into {imported, alias} pairs. */
function parseSpecifierList(clause) {
  const entries = [];
  for (const part of splitTopLevelList(clause)) {
    const match = /^([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(part);
    if (!match) continue;
    entries.push({ name: match[1], alias: match[2] ?? match[1] });
  }
  return entries;
}

const BOUNDARY = "(?<![\\w$.])";

/**
 * Parse a single module's static import/export surface.
 *
 * Returns { imports, reExports, starReExports, exports, dynamicImports, syntaxErrors }.
 * `exports` contains only statically knowable names; `hasStarExport` marks
 * `export *` so callers can treat unresolved names as unverifiable instead of
 * failing.
 */
export function parseModule(source) {
  const masked = maskNonCode(source);
  const imports = [];
  const reExports = [];
  const starReExports = [];
  const dynamicImports = [];
  const exports = new Set();
  const syntaxErrors = [];

  // Run a pattern over the masked copy (so strings/comments can never be
  // mistaken for code) and map every capture back onto the original source.
  // Every specifier pattern below ends with the closing quote, so the literal
  // body is always the final capture group immediately before that quote —
  // masking preserves offsets exactly, which makes this mapping safe.
  const record = (re, handler) => {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(masked)) !== null) {
      handler(match);
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
  };

  const specifierOf = (match) => {
    const last = match[match.length - 1] ?? "";
    const closingQuote = match.index + match[0].length - 1;
    return source.slice(closingQuote - last.length, closingQuote);
  };

  // import <clause> from "spec"
  const importRe = new RegExp(
    `${BOUNDARY}import\\s*([\\w$*{][^;()]*?)\\s*from\\s*(["'])([^"'\\n]+)\\2`,
    "g",
  );
  record(importRe, (match) => {
    const clause = match[1].trim();
    const specifier = specifierOf(match);
    const names = [];
    const brace = /\{([^}]*)\}/.exec(clause);
    if (brace) {
      for (const entry of parseSpecifierList(brace[1])) {
        names.push({ imported: entry.name, local: entry.alias });
      }
    }
    const star = /\*\s*as\s+([\w$]+)/.exec(clause);
    if (star) names.push({ imported: "*", local: star[1] });
    const defaultMatch = /^([\w$]+)\s*(?:,|$)/.exec(clause);
    if (defaultMatch && !clause.startsWith("{")) {
      names.push({ imported: "default", local: defaultMatch[1] });
    }
    imports.push({ specifier, names });
  });

  // bare side-effect import "spec"
  const bareImportRe = new RegExp(`${BOUNDARY}import\\s*(["'])([^"'\\n]+)\\1`, "g");
  record(bareImportRe, (match) => {
    imports.push({ specifier: specifierOf(match), names: [] });
  });

  // export * from "spec"  /  export * as ns from "spec"
  const starExportRe = new RegExp(
    `${BOUNDARY}export\\s*\\*\\s*(?:as\\s+([\\w$]+)\\s*)?from\\s*(["'])([^"'\\n]+)\\2`,
    "g",
  );
  record(starExportRe, (match) => {
    const specifier = specifierOf(match);
    if (match[1]) {
      exports.add(match[1]);
      reExports.push({ specifier, names: [{ imported: "*", exported: match[1] }] });
    } else {
      starReExports.push(specifier);
    }
  });

  // export {a as b} from "spec"
  const exportFromRe = new RegExp(
    `${BOUNDARY}export\\s*\\{([^}]*)\\}\\s*from\\s*(["'])([^"'\\n]+)\\2`,
    "g",
  );
  record(exportFromRe, (match) => {
    const names = parseSpecifierList(match[1]).map((entry) => ({
      imported: entry.name,
      exported: entry.alias,
    }));
    for (const entry of names) exports.add(entry.exported);
    reExports.push({ specifier: specifierOf(match), names });
  });

  // export {a as b}
  const exportListRe = new RegExp(`${BOUNDARY}export\\s*\\{([^}]*)\\}`, "g");
  record(exportListRe, (match) => {
    for (const entry of parseSpecifierList(match[1])) exports.add(entry.alias);
  });

  // export const/let/var/function/class name
  const exportDeclRe = new RegExp(
    `${BOUNDARY}export\\s+(?:async\\s+)?(?:const|let|var|function\\*?|class)\\s+([\\w$]+)`,
    "g",
  );
  record(exportDeclRe, (match) => {
    exports.add(match[1]);
  });

  if (new RegExp(`${BOUNDARY}export\\s+default`).test(masked)) exports.add("default");

  const dynamicRe = new RegExp(`${BOUNDARY}import\\s*\\(\\s*(["'])([^"'\\n]+)\\1`, "g");
  record(dynamicRe, (match) => {
    dynamicImports.push(specifierOf(match));
  });

  // A module that opens a template/string and never closes it is truncated.
  const openers = (masked.match(/[{([]/g) ?? []).length;
  const closers = (masked.match(/[})\]]/g) ?? []).length;
  if (Math.abs(openers - closers) > 0) {
    syntaxErrors.push(`unbalanced delimiters (${openers} openers vs ${closers} closers) — chunk may be truncated`);
  }

  return {
    imports,
    reExports,
    starReExports,
    dynamicImports,
    exports,
    syntaxErrors,
  };
}

export function isRelativeSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

export function resolveSpecifier(fromFile, specifier) {
  if (!isRelativeSpecifier(specifier)) return null;
  const base = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const segments = `${base}/${specifier}`.split("/");
  const stack = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") stack.pop();
    else stack.push(segment);
  }
  return stack.join("/");
}

/**
 * Validate an in-memory bundle.
 *
 * @param {Record<string, string>} files map of bundle-relative path -> source
 * @returns {{ok: boolean, checkedModules: number, checkedImports: number,
 *            errors: Array<object>, warnings: Array<object>}}
 */
export function analyzeBundle(files) {
  const errors = [];
  const warnings = [];
  const parsed = new Map();
  let checkedImports = 0;

  for (const [file, source] of Object.entries(files)) {
    if (!MODULE_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;
    let module;
    try {
      module = parseModule(source);
    } catch (error) {
      errors.push({ file, reason: "parse-failure", detail: String(error) });
      continue;
    }
    parsed.set(file, module);
    for (const issue of module.syntaxErrors) {
      errors.push({ file, reason: "syntax", detail: issue });
    }
  }

  for (const [file, module] of parsed) {
    const edges = [
      ...module.imports.map((edge) => ({ ...edge, kind: "import" })),
      ...module.reExports.map((edge) => ({ ...edge, kind: "re-export" })),
      ...module.starReExports.map((specifier) => ({ specifier, names: [], kind: "star-re-export" })),
      ...module.dynamicImports.map((specifier) => ({ specifier, names: [], kind: "dynamic-import" })),
    ];

    for (const edge of edges) {
      if (!isRelativeSpecifier(edge.specifier)) continue;
      const target = resolveSpecifier(file, edge.specifier);
      const targetModule = target ? parsed.get(target) : undefined;
      if (!target || !Object.prototype.hasOwnProperty.call(files, target)) {
        errors.push({
          file,
          specifier: edge.specifier,
          target,
          kind: edge.kind,
          reason: "missing-module",
          detail: `"${file}" references "${edge.specifier}" but ${target ?? "(unresolvable)"} is not part of this bundle`,
        });
        continue;
      }
      if (!targetModule) continue; // non-JS (e.g. .css) — nothing to link

      for (const name of edge.names) {
        checkedImports += 1;
        if (name.imported === "*") continue;
        if (targetModule.exports.has(name.imported)) continue;
        if (targetModule.starReExports.length > 0) {
          warnings.push({
            file,
            specifier: edge.specifier,
            name: name.imported,
            reason: "unverifiable-through-star-export",
          });
          continue;
        }
        errors.push({
          file,
          specifier: edge.specifier,
          target,
          kind: edge.kind,
          reason: "missing-export",
          symbol: name.imported,
          detail:
            `"${file}" imports "${name.imported}" from "${edge.specifier}" ` +
            `but ${target} does not provide an export named '${name.imported}'`,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    checkedModules: parsed.size,
    checkedImports,
    errors,
    warnings,
  };
}

/** Extract asset references (scripts, modulepreloads, stylesheets) from index.html. */
export function extractHtmlAssets(html) {
  const assets = new Set();
  const attributeRe = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = attributeRe.exec(html)) !== null) {
    const value = match[1];
    if (/\.(?:js|mjs|cjs|css|json)$/.test(value)) assets.add(normalizeAssetPath(value));
  }
  return [...assets];
}

function normalizeAssetPath(value) {
  if (/^https?:\/\//.test(value)) {
    try {
      return new URL(value).pathname.replace(/^\//, "");
    } catch {
      return value;
    }
  }
  return value.replace(/^\//, "").replace(/^\.\//, "");
}

/**
 * Validate consistency between the emitted index.html and the emitted assets,
 * then validate the module graph reachable from the referenced entry points.
 */
export function analyzeBuild({ html, files }) {
  const errors = [];
  const warnings = [];
  const referenced = html ? extractHtmlAssets(html) : [];

  for (const asset of referenced) {
    if (!Object.prototype.hasOwnProperty.call(files, asset)) {
      errors.push({
        file: "index.html",
        reason: "missing-asset",
        detail: `index.html references "${asset}" but no such file was emitted`,
      });
    }
  }

  const graph = analyzeBundle(files);
  errors.push(...graph.errors);
  warnings.push(...graph.warnings);

  return {
    ok: errors.length === 0,
    referencedAssets: referenced,
    checkedModules: graph.checkedModules,
    checkedImports: graph.checkedImports,
    errors,
    warnings,
  };
}
